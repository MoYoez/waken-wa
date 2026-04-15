import { and, eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

import {
  clearActivityFeedDataCache,
} from '@/lib/activity-feed'
import { recordReportedActivityHistory } from '@/lib/activity-history-pending'
import {
  ADMIN_ACTIVITY_RESERVED_METADATA_KEYS,
  parseActivityReportBody,
  parseAdminPersistSeconds,
} from '@/lib/activity-report-parser'
import {
  ADMIN_PERSIST_SECONDS_METADATA_KEY,
  redactGeneratedHashKeyForClient,
  upsertActivity,
  USER_ACTIVITY_DB_SYNCED_METADATA_KEY,
  USER_PERSIST_EXPIRES_AT_METADATA_KEY,
} from '@/lib/activity-store'
import { requireAdminSession, unauthorizedJson } from '@/lib/admin-api-auth'
import { db } from '@/lib/db'
import { clearDeviceAuthCache } from '@/lib/device-auth-cache'
import {
  GENERATED_HASH_KEY_MAX_LENGTH,
  WEB_ADMIN_QUICK_ADD_DEVICE_HASH_KEY,
} from '@/lib/device-constants'
import { devices, userActivities } from '@/lib/drizzle-schema'
import { getRequestLanguage } from '@/lib/i18n/request-locale'
import { getT } from '@/lib/i18n/server'
import { removeRealtimeActivity, upsertRealtimeActivity } from '@/lib/realtime-activity-cache'
import { readJsonObject } from '@/lib/request-json'
import { getSiteConfigMemoryFirst } from '@/lib/site-config-cache'
import { parseProcessStaleSeconds } from '@/lib/site-config-constants'
import { sqlDate, sqlTimestamp } from '@/lib/sql-timestamp'
import { toDbJsonValue } from '@/lib/sqlite-json'

// Force dynamic rendering; disable caching
export const dynamic = 'force-dynamic'
export const revalidate = 0

/** POST: admin manual activity (writes activity-store like public report). */
export async function POST(request: NextRequest) {
  const { t } = await getT('admin', { lng: getRequestLanguage(request) })
  const session = await requireAdminSession()
  if (!session) {
    return unauthorizedJson()
  }

  try {
    const body = await request.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ success: false, error: t('api.activity.invalidBody') }, { status: 400 })
    }

    const parsedBody = parseActivityReportBody(body as Record<string, unknown>, {
      stripMetadataKeysBeforeValidate: ADMIN_ACTIVITY_RESERVED_METADATA_KEYS,
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
    } = parsedBody.data
    const adminPersistSeconds = parseAdminPersistSeconds(body as Record<string, unknown>)

    const siteCfg = await getSiteConfigMemoryFirst()
    const realtimeTtlSeconds = parseProcessStaleSeconds(siteCfg?.processStaleSeconds)
    let finalMetadata = metadata
    let adminExpiresAt: Date | undefined
    if (adminPersistSeconds != null) {
      adminExpiresAt = new Date(Date.now() + adminPersistSeconds * 1000)
    }
    const finalExpiresAt = adminExpiresAt ?? new Date(Date.now() + realtimeTtlSeconds * 1000)

    if (!process_name) {
      return NextResponse.json(
        { success: false, error: t('api.activity.missingProcessName') },
        { status: 400 },
      )
    }

    const effectiveHashKey =
      generatedHashKey.length > 0 ? generatedHashKey : WEB_ADMIN_QUICK_ADD_DEVICE_HASH_KEY

    if (generatedHashKey.length > GENERATED_HASH_KEY_MAX_LENGTH) {
      return NextResponse.json(
        { success: false, error: t('api.activity.hashTooLong') },
        { status: 400 },
      )
    }

    if (!generatedHashKey) {
      const now = sqlTimestamp()
      await db
        .insert(devices)
        .values({
          generatedHashKey: WEB_ADMIN_QUICK_ADD_DEVICE_HASH_KEY,
          displayName: t('api.activity.webQuickAddDisplayName'),
          status: 'active',
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: devices.generatedHashKey,
          set: { status: 'active', updatedAt: now },
        })
      clearDeviceAuthCache()
    }

    const [deviceRecord] = await db
      .select()
      .from(devices)
      .where(eq(devices.generatedHashKey, effectiveHashKey))
      .limit(1)
    if (!deviceRecord || deviceRecord.status !== 'active') {
      return NextResponse.json(
        {
          success: false,
          error: t('api.activity.deviceUnavailable'),
        },
        { status: 403 },
      )
    }

    if (adminPersistSeconds != null) {
      finalMetadata = {
        ...(finalMetadata || {}),
        [ADMIN_PERSIST_SECONDS_METADATA_KEY]: adminPersistSeconds,
        pushMode: 'active',
        [USER_PERSIST_EXPIRES_AT_METADATA_KEY]: finalExpiresAt.toISOString(),
        [USER_ACTIVITY_DB_SYNCED_METADATA_KEY]: true,
      }
      const now = sqlTimestamp()
      const expiresAtVal = sqlDate(finalExpiresAt)
      await db
        .insert(userActivities)
        .values({
          deviceId: deviceRecord.id,
          generatedHashKey: effectiveHashKey,
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
            generatedHashKey: effectiveHashKey,
            processTitle: process_title,
            metadata: toDbJsonValue(finalMetadata),
            expiresAt: expiresAtVal,
            updatedAt: now,
          },
        })
      await removeRealtimeActivity(effectiveHashKey, process_name)
    } else {
      finalMetadata = {
        ...(finalMetadata || {}),
        pushMode: 'realtime',
      }
      await upsertRealtimeActivity(
        {
          deviceId: deviceRecord.id,
          device,
          generatedHashKey: effectiveHashKey,
          processName: process_name,
          processTitle: process_title,
          metadata: finalMetadata,
          startedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          expiresAt: finalExpiresAt.toISOString(),
        },
        realtimeTtlSeconds,
      )
    }

    const entry = upsertActivity({
      device,
      generatedHashKey: effectiveHashKey,
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
      // history capture should never block admin activity
    }

    const seenAt = sqlTimestamp()
    await db
      .update(devices)
      .set({
        displayName: device || deviceRecord.displayName,
        lastSeenAt: seenAt,
        updatedAt: seenAt,
      })
      .where(eq(devices.id, deviceRecord.id))

    await clearActivityFeedDataCache()

    return NextResponse.json(
      {
        success: true,
        data: redactGeneratedHashKeyForClient(entry as unknown as Record<string, unknown>),
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('添加活动失败:', error)
    return NextResponse.json({ success: false, error: t('api.activity.addFailed') }, { status: 500 })
  }
}

/** PATCH: end admin-managed persistent activity immediately. */
export async function PATCH(request: NextRequest) {
  const { t } = await getT('admin', { lng: getRequestLanguage(request) })
  const session = await requireAdminSession()
  if (!session) {
    return unauthorizedJson()
  }

  try {
    const body = await readJsonObject(request)
    const id = Number(body?.id)
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json(
        { success: false, error: t('api.activity.invalidPersistentId') },
        { status: 400 },
      )
    }

    const [activity] = await db
      .select({
        id: userActivities.id,
        metadata: userActivities.metadata,
      })
      .from(userActivities)
      .where(eq(userActivities.id, id))
      .limit(1)

    if (!activity) {
      return NextResponse.json({ success: false, error: t('api.activity.notFoundOrExpired') }, { status: 404 })
    }

    const pushMode = String(
      ((activity.metadata as Record<string, unknown> | null)?.pushMode ?? ''),
    )
      .trim()
      .toLowerCase()
    if (pushMode === 'realtime') {
      return NextResponse.json({ success: false, error: t('api.activity.realtimeNotEndable') }, { status: 409 })
    }

    await db.delete(userActivities).where(eq(userActivities.id, id))
    await clearActivityFeedDataCache()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('结束活动失败:', error)
    return NextResponse.json({ success: false, error: t('api.activity.endFailed') }, { status: 500 })
  }
}
