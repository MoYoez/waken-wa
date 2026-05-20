import { and, eq, isNull, lt, or } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

import {
  ACTIVITY_FEED_DEFAULT_LIMIT,
} from '@/constants/activity-api'
import { DEVICE_LAST_SEEN_WRITE_THROTTLE_MS } from '@/constants/activity-report'
import { clearActivityFeedDataCache, getActivityFeedData } from '@/lib/activity-feed'
import { recordReportedActivityHistory } from '@/lib/activity-history-pending'
import {
  parseActivityReportBody,
  PUBLIC_ACTIVITY_RESERVED_METADATA_KEYS,
} from '@/lib/activity-report-parser'
import {
  redactGeneratedHashKeyForClient,
  upsertActivity,
  USER_ACTIVITY_DB_SYNCED_METADATA_KEY,
  USER_PERSIST_EXPIRES_AT_METADATA_KEY,
} from '@/lib/activity-store'
import {
  consumeApiTokenSecondaryReviewBypass,
  resolveActiveApiTokenFromPlainSecret,
} from '@/lib/api-token-secret'
import { getSession, isSiteLockSatisfied } from '@/lib/auth'
import { db } from '@/lib/db'
import { clearDeviceAuthCache } from '@/lib/device-auth-cache'
import { devices, userActivities } from '@/lib/drizzle-schema'
import { isLockScreenReporterProcessName } from '@/lib/lockapp-reporter'
import { saveCoverFromDataUrl } from '@/lib/media-cover-storage'
import { findMediaPlaySourceRuleMatch } from '@/lib/media-play-source-rules'
import { buildDeviceApprovalUrl, getPublicOrigin } from '@/lib/public-request-url'
import { removeRealtimeActivity, upsertRealtimeActivity } from '@/lib/realtime-activity-cache'
import { getSiteConfigMemoryFirst } from '@/lib/site-config-cache'
import { parseProcessStaleSeconds } from '@/lib/site-config-values'
import { sqlDate, sqlTimestamp } from '@/lib/sql-timestamp'
import { toDbJsonValue } from '@/lib/sqlite-json'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function mediaPlaySourceBlocked(config: unknown, metadata: Record<string, unknown>): boolean {
  const cfg = config as Record<string, unknown> | null
  return (
    findMediaPlaySourceRuleMatch(
      metadata,
      cfg?.mediaPlaySourceRules,
      cfg?.mediaPlaySourceBlocklist,
    )?.action === 'block'
  )
}

function stripMediaAppIconFields(metadata: Record<string, unknown>): Record<string, unknown> {
  const media = metadata.media
  if (!media || typeof media !== 'object' || Array.isArray(media)) return metadata

  const nextMedia = { ...(media as Record<string, unknown>) }
  for (const key of [
    'appIconUrl',
    'app_icon_url',
    'iconUrl',
    'icon_url',
    'sourceIconUrl',
    'playSourceIconUrl',
    'playerIconUrl',
    'programIconUrl',
    'appIcon',
    'icon',
  ]) {
    delete nextMedia[key]
  }
  return { ...metadata, media: nextMedia }
}

async function validateToken(
  request: NextRequest,
): Promise<{
  id: number
  bypassSecondaryReview: boolean
  bypassSecondaryReviewFirstUseOnly: boolean
} | null> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }
  return resolveActiveApiTokenFromPlainSecret(authHeader.slice(7))
}

/** GET: admin session, or `?public=1` with site lock satisfied. */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const isPublicMode = searchParams.get('public') === '1'

    if (isPublicMode) {
      const siteLockOk = await isSiteLockSatisfied()
      if (!siteLockOk) {
        return NextResponse.json(
          { success: false, error: 'Please unlock the page first' },
          { status: 403 },
        )
      }
      const feed = await getActivityFeedData(ACTIVITY_FEED_DEFAULT_LIMIT, {
        forPublicFeed: true,
      })
      return NextResponse.json({
        success: true,
        data: feed,
      })
    }

    const session = await getSession()
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const feed = await getActivityFeedData(ACTIVITY_FEED_DEFAULT_LIMIT)
    return NextResponse.json({
      success: true,
      data: feed,
    })
  } catch (error) {
    console.error('Failed to fetch activity logs:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch activity logs' },
      { status: 500 },
    )
  }
}

/** POST: device activity report (Bearer API token). */
export async function POST(request: NextRequest) {
  try {
    const tokenInfo = await validateToken(request)
    if (!tokenInfo) {
      return NextResponse.json(
        { success: false, error: 'Invalid API token' },
        { status: 401 },
      )
    }
    const canBypassSecondaryReview = !tokenInfo.bypassSecondaryReview
      ? false
      : tokenInfo.bypassSecondaryReviewFirstUseOnly
        ? await consumeApiTokenSecondaryReviewBypass(tokenInfo.id)
        : true

    const body = await request.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body' },
        { status: 400 },
      )
    }

    const parsedBody = parseActivityReportBody(body as Record<string, unknown>, {
      stripMetadataKeysAfterNormalize: PUBLIC_ACTIVITY_RESERVED_METADATA_KEYS,
      extractMediaCoverDataUrl: true,
      extractMediaAppIconDataUrl: true,
    })
    if (!parsedBody.ok) {
      return NextResponse.json({ success: false, error: parsedBody.error }, { status: parsedBody.status })
    }

    const {
      generatedHashKey,
      device,
      processName: process_name,
      processTitle: process_title,
      metadata,
      mediaCoverDataUrl,
      mediaAppIconDataUrl,
    } = parsedBody.data

    if (!generatedHashKey || !process_name) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: generatedHashKey and process_name' },
        { status: 400 },
      )
    }

    let [deviceRecord] = await db
      .select()
      .from(devices)
      .where(eq(devices.generatedHashKey, generatedHashKey))
      .limit(1)
    const reportAtMs = Date.now()

    const siteCfg = await getSiteConfigMemoryFirst()

    if (!deviceRecord) {
      const autoAccept = Boolean(siteCfg?.autoAcceptNewDevices)
      const skipReview = autoAccept || canBypassSecondaryReview
      const createdStatus = skipReview ? 'active' : 'pending'
      const now = sqlTimestamp()
      const [created] = await db
        .insert(devices)
        .values({
          generatedHashKey,
          displayName: device || 'Unknown Device',
          status: createdStatus,
          apiTokenId: tokenInfo.id,
          lastSeenAt: skipReview ? now : null,
          updatedAt: now,
        })
        .returning()
      deviceRecord = created!
      clearDeviceAuthCache()

      if (!skipReview) {
        const approvalUrl = buildDeviceApprovalUrl(request, generatedHashKey)
        return NextResponse.json(
          {
            success: false,
            error: 'Device is pending admin review',
            pending: true,
            approvalUrl,
            registration: {
              displayName: device || 'Unknown Device',
              generatedHashKey,
              status: 'pending' as const,
            },
          },
          { status: 202 },
        )
      }
    }

    if (deviceRecord.status === 'pending') {
      const approvalUrl = buildDeviceApprovalUrl(request, generatedHashKey)
      return NextResponse.json(
        {
          success: false,
          error: 'Device is pending admin review',
          pending: true,
          approvalUrl,
          registration: {
            displayName: deviceRecord.displayName,
            generatedHashKey,
            status: 'pending' as const,
          },
        },
        { status: 202 },
      )
    }

    if (deviceRecord.status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'Device is unavailable or does not exist' },
        { status: 403 },
      )
    }

    if (!deviceRecord.apiTokenId) {
      const now = sqlTimestamp()
      const nextStatus = canBypassSecondaryReview ? 'active' : 'pending'
      const [updated] = await db
        .update(devices)
        .set({
          status: nextStatus,
          apiTokenId: tokenInfo.id,
          lastSeenAt: canBypassSecondaryReview ? now : deviceRecord.lastSeenAt,
          updatedAt: now,
        })
        .where(eq(devices.id, deviceRecord.id))
        .returning()
      if (updated) {
        deviceRecord = updated
      }
      clearDeviceAuthCache()
      if (canBypassSecondaryReview) {
        if (deviceRecord.status !== 'active') {
          return NextResponse.json(
            { success: false, error: 'Device is unavailable or does not exist' },
            { status: 403 },
          )
        }
      } else {
      const approvalUrl = buildDeviceApprovalUrl(request, generatedHashKey)
      return NextResponse.json(
        {
          success: false,
          error: 'Device is not bound to a token. Bind and approve it in admin first.',
          pending: true,
          approvalUrl,
          registration: {
            displayName: deviceRecord.displayName,
            generatedHashKey,
            status: 'pending' as const,
          },
        },
        { status: 202 },
      )
      }
    }

    if (deviceRecord.apiTokenId && deviceRecord.apiTokenId !== tokenInfo.id) {
      const now = sqlTimestamp()
      const nextStatus = canBypassSecondaryReview ? 'active' : 'pending'
      const [updated] = await db
        .update(devices)
        .set({
          status: nextStatus,
          apiTokenId: tokenInfo.id,
          lastSeenAt: canBypassSecondaryReview ? now : deviceRecord.lastSeenAt,
          updatedAt: now,
        })
        .where(eq(devices.id, deviceRecord.id))
        .returning()
      if (updated) {
        deviceRecord = updated
      }
      clearDeviceAuthCache()
      if (canBypassSecondaryReview) {
        if (deviceRecord.status !== 'active') {
          return NextResponse.json(
            { success: false, error: 'Device is unavailable or does not exist' },
            { status: 403 },
          )
        }
      } else {
      const approvalUrl = buildDeviceApprovalUrl(request, generatedHashKey)
      return NextResponse.json(
        {
          success: false,
          error: 'New token binding detected. The old token was unbound and admin review is required.',
          pending: true,
          approvalUrl,
          registration: {
            displayName: deviceRecord.displayName,
            generatedHashKey,
            status: 'pending' as const,
          },
        },
        { status: 202 },
      )
      }
    }

    if (
      siteCfg?.activityRejectLockappSleep === true &&
      isLockScreenReporterProcessName(process_name)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Sleep-as-offline is enabled, so lock-screen activity reports are rejected.',
        },
        { status: 403 },
      )
    }

    const pushModeNorm = String((metadata as Record<string, unknown> | null)?.pushMode ?? '')
      .trim()
      .toLowerCase()
    const isActivePush = pushModeNorm === 'active' || pushModeNorm === 'persistent'
    const realtimeTtlSeconds = parseProcessStaleSeconds(siteCfg?.processStaleSeconds)
    const realtimeExpiresAt = new Date(reportAtMs + realtimeTtlSeconds * 1000)
    const finalMetadata: Record<string, unknown> = {
      ...(metadata || {}),
      pushMode: isActivePush ? 'active' : 'realtime',
      ...(isActivePush
        ? {
            [USER_PERSIST_EXPIRES_AT_METADATA_KEY]: realtimeExpiresAt.toISOString(),
            [USER_ACTIVITY_DB_SYNCED_METADATA_KEY]: true,
          }
        : {}),
    }

    const sourceBlocked = mediaPlaySourceBlocked(siteCfg, finalMetadata)
    const enableCover =
      siteCfg?.mediaDisplayShowCover === true &&
      !sourceBlocked

    if (enableCover && mediaCoverDataUrl) {
      const maxCoverCount = Number(siteCfg.mediaCoverMaxCount ?? 50)
      const baseUrl = getPublicOrigin(request)
      const coverInfo = await saveCoverFromDataUrl(
        deviceRecord.id,
        generatedHashKey,
        mediaCoverDataUrl,
        Number.isFinite(maxCoverCount) && maxCoverCount >= 0 ? maxCoverCount : 50,
        baseUrl,
      )
      if (coverInfo) {
        const media = finalMetadata.media
        finalMetadata.media =
          media && typeof media === 'object' && !Array.isArray(media)
            ? { ...(media as Record<string, unknown>), coverUrl: coverInfo.url }
            : { coverUrl: coverInfo.url }
      }
    }

    const enableAppIcon =
      siteCfg?.mediaDisplayShowAppIcon === true &&
      !sourceBlocked

    if (enableAppIcon && mediaAppIconDataUrl) {
      const maxCoverCount = Number(siteCfg.mediaCoverMaxCount ?? 50)
      const baseUrl = getPublicOrigin(request)
      const iconInfo = await saveCoverFromDataUrl(
        deviceRecord.id,
        generatedHashKey,
        mediaAppIconDataUrl,
        Number.isFinite(maxCoverCount) && maxCoverCount >= 0 ? maxCoverCount : 50,
        baseUrl,
      )
      if (iconInfo) {
        const media = finalMetadata.media
        finalMetadata.media =
          media && typeof media === 'object' && !Array.isArray(media)
            ? { ...(media as Record<string, unknown>), appIconUrl: iconInfo.url }
            : { appIconUrl: iconInfo.url }
      }
    } else if (!enableAppIcon) {
      Object.assign(finalMetadata, stripMediaAppIconFields(finalMetadata))
    }

    if (isActivePush) {
      const now = sqlTimestamp()
      const expiresAtVal = sqlDate(realtimeExpiresAt)
      await db
        .insert(userActivities)
        .values({
          deviceId: deviceRecord.id,
          generatedHashKey,
          processName: process_name,
          processTitle: process_title,
          metadata: toDbJsonValue(finalMetadata),
          startedAt: now,
          expiresAt: expiresAtVal,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [userActivities.deviceId, userActivities.processName],
          set: {
            generatedHashKey,
            processTitle: process_title,
            metadata: toDbJsonValue(finalMetadata),
            expiresAt: expiresAtVal,
            updatedAt: now,
          },
        })
      await removeRealtimeActivity(generatedHashKey, process_name)
    } else {
      await upsertRealtimeActivity(
        {
          deviceId: deviceRecord.id,
          device,
          generatedHashKey,
          processName: process_name,
          processTitle: process_title,
          metadata: finalMetadata,
          startedAt: new Date(reportAtMs).toISOString(),
          updatedAt: new Date(reportAtMs).toISOString(),
          expiresAt: realtimeExpiresAt.toISOString(),
        },
        realtimeTtlSeconds,
      )
    }

    const entry = upsertActivity({
      device,
      generatedHashKey,
      deviceId: deviceRecord.id,
      processName: process_name,
      processTitle: process_title,
      metadata: finalMetadata,
    })

    try {
      await recordReportedActivityHistory({
        processName: process_name,
        processTitle: process_title,
        deviceType: (finalMetadata as Record<string, unknown> | null)?.deviceType,
        playSource: (finalMetadata as Record<string, unknown> | null)?.play_source,
      })
    } catch {
      // history capture should never block reporting
    }

    const seenAt = sqlDate(new Date(reportAtMs))
    const lastSeenCutoff = sqlDate(new Date(reportAtMs - DEVICE_LAST_SEEN_WRITE_THROTTLE_MS))
    await db
      .update(devices)
      .set({
        displayName: device || deviceRecord.displayName,
        lastSeenAt: seenAt,
        updatedAt: seenAt,
      })
      .where(
        and(
          eq(devices.id, deviceRecord.id),
          or(isNull(devices.lastSeenAt), lt(devices.lastSeenAt, lastSeenCutoff)),
        ),
      )

    await clearActivityFeedDataCache()

    return NextResponse.json({
      success: true,
      data: redactGeneratedHashKeyForClient(entry as unknown as Record<string, unknown>),
    }, { status: 200 })
  } catch (error) {
    console.error('Failed to report activity:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to report activity' },
      { status: 500 },
    )
  }
}
