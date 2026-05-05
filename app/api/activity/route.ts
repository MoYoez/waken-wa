import { and, eq, isNull, lt, or } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

import {
  ACTIVITY_FEED_DEFAULT_LIMIT,
} from '@/lib/activity-api-constants'
import { clearActivityFeedDataCache, getActivityFeedData } from '@/lib/activity-feed'
import { recordReportedActivityHistory } from '@/lib/activity-history-pending'
import { DEVICE_LAST_SEEN_WRITE_THROTTLE_MS } from '@/lib/activity-report-constants'
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
import { resolveActiveApiTokenFromPlainSecret } from '@/lib/api-token-secret'
import { getSession, isSiteLockSatisfied } from '@/lib/auth'
import { db } from '@/lib/db'
import { clearDeviceAuthCache } from '@/lib/device-auth-cache'
import { devices, userActivities } from '@/lib/drizzle-schema'
import { isLockScreenReporterProcessName } from '@/lib/lockapp-reporter'
import { saveCoverFromDataUrl } from '@/lib/media-cover-storage'
import { buildDeviceApprovalUrl, getPublicOrigin } from '@/lib/public-request-url'
import { removeRealtimeActivity, upsertRealtimeActivity } from '@/lib/realtime-activity-cache'
import { getSiteConfigMemoryFirst } from '@/lib/site-config-cache'
import { parseProcessStaleSeconds } from '@/lib/site-config-constants'
import { sqlDate, sqlTimestamp } from '@/lib/sql-timestamp'
import { toDbJsonValue } from '@/lib/sqlite-json'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function normalizeMediaPlaySource(value: unknown): string {
  return String(value ?? '').trim().toLowerCase()
}

function mediaPlaySourceBlocked(config: unknown, metadata: Record<string, unknown>): boolean {
  const blockedSources = (config as Record<string, unknown> | null)?.mediaPlaySourceBlocklist
  if (!Array.isArray(blockedSources) || blockedSources.length === 0) return false

  const source = normalizeMediaPlaySource(metadata.play_source)
  if (!source) return false
  return blockedSources.some((item) => normalizeMediaPlaySource(item) === source)
}

async function validateToken(request: NextRequest): Promise<{ id: number } | null> {
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
          { success: false, error: '请先解锁页面' },
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
      return NextResponse.json({ success: false, error: '未授权' }, { status: 401 })
    }

    const feed = await getActivityFeedData(ACTIVITY_FEED_DEFAULT_LIMIT)
    return NextResponse.json({
      success: true,
      data: feed,
    })
  } catch (error) {
    console.error('获取活动日志失败:', error)
    return NextResponse.json(
      { success: false, error: '获取活动日志失败' },
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
        { success: false, error: '无效的 API Token' },
        { status: 401 },
      )
    }

    const body = await request.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json(
        { success: false, error: '请求体格式无效' },
        { status: 400 },
      )
    }

    const parsedBody = parseActivityReportBody(body as Record<string, unknown>, {
      stripMetadataKeysAfterNormalize: PUBLIC_ACTIVITY_RESERVED_METADATA_KEYS,
      extractMediaCoverDataUrl: true,
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
    } = parsedBody.data

    if (!generatedHashKey || !process_name) {
      return NextResponse.json(
        { success: false, error: '缺少必要字段: generatedHashKey（设备身份牌）、process_name' },
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
      const createdStatus = autoAccept ? 'active' : 'pending'
      const now = sqlTimestamp()
      const [created] = await db
        .insert(devices)
        .values({
          generatedHashKey,
          displayName: device || 'Unknown Device',
          status: createdStatus,
          apiTokenId: tokenInfo.id,
          lastSeenAt: autoAccept ? now : null,
          updatedAt: now,
        })
        .returning()
      deviceRecord = created!
      clearDeviceAuthCache()

      if (!autoAccept) {
        const approvalUrl = buildDeviceApprovalUrl(request, generatedHashKey)
        return NextResponse.json(
          {
            success: false,
            error: '设备待后台审核后可用',
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
          error: '设备待后台审核后可用',
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
        { success: false, error: '设备不可用或不存在' },
        { status: 403 },
      )
    }

    if (!deviceRecord.apiTokenId) {
      const now = sqlTimestamp()
      const [updated] = await db
        .update(devices)
        .set({
          status: 'pending',
          updatedAt: now,
        })
        .where(eq(devices.id, deviceRecord.id))
        .returning()
      if (updated) {
        deviceRecord = updated
      }
      clearDeviceAuthCache()
      const approvalUrl = buildDeviceApprovalUrl(request, generatedHashKey)
      return NextResponse.json(
        {
          success: false,
          error: '设备未绑定 Token，需后台绑定并审核后可用',
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

    if (deviceRecord.apiTokenId && deviceRecord.apiTokenId !== tokenInfo.id) {
      const now = sqlTimestamp()
      const [updated] = await db
        .update(devices)
        .set({
          status: 'pending',
          apiTokenId: tokenInfo.id,
          updatedAt: now,
        })
        .where(eq(devices.id, deviceRecord.id))
        .returning()
      if (updated) {
        deviceRecord = updated
      }
      clearDeviceAuthCache()
      const approvalUrl = buildDeviceApprovalUrl(request, generatedHashKey)
      return NextResponse.json(
        {
          success: false,
          error: '设备已检测到新 Token 绑定请求：旧 Token 已解绑，待后台审核确认切换',
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

    if (
      siteCfg?.activityRejectLockappSleep === true &&
      isLockScreenReporterProcessName(process_name)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: '站点已开启「休眠视作离线」，已拒绝 LockApp / loginwindow 等锁屏活动上报',
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

    const enableCover =
      siteCfg?.mediaDisplayShowCover === true &&
      !mediaPlaySourceBlocked(siteCfg, finalMetadata)

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
    console.error('上报活动失败:', error)
    return NextResponse.json(
      { success: false, error: '上报活动失败' },
      { status: 500 },
    )
  }
}
