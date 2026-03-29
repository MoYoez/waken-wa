import { and, eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

import {
  ACTIVITY_METADATA_MAX_JSON_LENGTH,
  ACTIVITY_METADATA_MAX_KEYS,
  DEVICE_BATTERY_PERCENT_MAX,
  DEVICE_BATTERY_PERCENT_MIN,
} from '@/lib/activity-api-constants'
import {
  ADMIN_PERSIST_SECONDS_METADATA_KEY,
  redactGeneratedHashKeyForClient,
  upsertActivity,
  USER_ACTIVITY_DB_SYNCED_METADATA_KEY,
  USER_PERSIST_EXPIRES_AT_METADATA_KEY,
} from '@/lib/activity-store'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  GENERATED_HASH_KEY_MAX_LENGTH,
  WEB_ADMIN_QUICK_ADD_DEVICE_HASH_KEY,
} from '@/lib/device-constants'
import { sqlTimestamp } from '@/lib/sql-timestamp'
import { devices, userActivities } from '@/lib/drizzle-schema'
import { USER_ACTIVITY_PERSIST_MAX_SEC, USER_ACTIVITY_PERSIST_MIN_SEC } from '@/lib/user-activity-persist'

// Force dynamic rendering; disable caching
export const dynamic = 'force-dynamic'
export const revalidate = 0

async function requireAdmin() {
  const session = await getSession()
  if (!session) return null
  return session
}

/** POST: admin manual activity (writes activity-store like public report). */
export async function POST(request: NextRequest) {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ success: false, error: '未授权' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const generatedHashKeyRaw = body?.generatedHashKey
    const deviceRaw = body?.device
    const processNameRaw = body?.process_name
    const processTitleRaw = body?.process_title
    const batteryRaw = body?.battery_level ?? body?.device_battery
    const deviceTypeRaw = body?.device_type
    const pushModeRaw = body?.push_mode
    const metadataRaw = body?.metadata
    const persistMinutesRaw = body?.persist_minutes ?? body?.persistMinutes

    const generatedHashKey =
      typeof generatedHashKeyRaw === 'string'
        ? generatedHashKeyRaw.trim()
        : ''
    const device =
      typeof deviceRaw === 'string'
        ? deviceRaw.trim()
        : 'Unknown Device'
    const process_name =
      typeof processNameRaw === 'string'
        ? processNameRaw.trim()
        : ''
    const process_title =
      typeof processTitleRaw === 'string'
        ? processTitleRaw.trim()
        : null

    let metadata: Record<string, unknown> | null = null
    if (metadataRaw && typeof metadataRaw === 'object' && !Array.isArray(metadataRaw)) {
      metadata = { ...(metadataRaw as Record<string, unknown>) }
      delete metadata[ADMIN_PERSIST_SECONDS_METADATA_KEY]
      delete metadata[USER_PERSIST_EXPIRES_AT_METADATA_KEY]
      delete metadata[USER_ACTIVITY_DB_SYNCED_METADATA_KEY]
      const metaKeys = Object.keys(metadata)
      if (
        metaKeys.length > ACTIVITY_METADATA_MAX_KEYS ||
        JSON.stringify(metadata).length > ACTIVITY_METADATA_MAX_JSON_LENGTH
      ) {
        return NextResponse.json(
          { success: false, error: 'metadata 数据过大' },
          { status: 400 },
        )
      }
    }
    if (typeof batteryRaw === 'number' && Number.isFinite(batteryRaw)) {
      const batteryLevel = Math.min(
        Math.max(Math.round(batteryRaw), DEVICE_BATTERY_PERCENT_MIN),
        DEVICE_BATTERY_PERCENT_MAX,
      )
      metadata = {
        ...(metadata || {}),
        deviceBatteryPercent: batteryLevel,
      }
    }

    if (typeof deviceTypeRaw === 'string') {
      const normalizedType = deviceTypeRaw.trim().toLowerCase()
      if (normalizedType === 'mobile' || normalizedType === 'tablet' || normalizedType === 'desktop') {
        metadata = {
          ...(metadata || {}),
          deviceType: normalizedType,
        }
      }
    }

    if (typeof pushModeRaw === 'string') {
      const normalizedMode = pushModeRaw.trim().toLowerCase()
      if (normalizedMode === 'realtime' || normalizedMode === 'active' || normalizedMode === 'persistent') {
        metadata = {
          ...(metadata || {}),
          pushMode: normalizedMode === 'persistent' ? 'active' : normalizedMode,
        }
      }
    }

    let adminPersistSeconds: number | undefined
    if (persistMinutesRaw !== undefined && persistMinutesRaw !== null) {
      const mins = Number(persistMinutesRaw)
      if (Number.isFinite(mins) && mins > 0) {
        const sec = Math.round(mins * 60)
        adminPersistSeconds = Math.min(
          Math.max(sec, USER_ACTIVITY_PERSIST_MIN_SEC),
          USER_ACTIVITY_PERSIST_MAX_SEC,
        )
      }
    }
    let finalMetadata = metadata
    let adminExpiresAt: Date | undefined
    if (adminPersistSeconds != null) {
      adminExpiresAt = new Date(Date.now() + adminPersistSeconds * 1000)
      finalMetadata = {
        ...(finalMetadata || {}),
        [ADMIN_PERSIST_SECONDS_METADATA_KEY]: adminPersistSeconds,
        pushMode: 'active',
        [USER_PERSIST_EXPIRES_AT_METADATA_KEY]: adminExpiresAt.toISOString(),
        [USER_ACTIVITY_DB_SYNCED_METADATA_KEY]: true,
      }
    }

    if (!process_name) {
      return NextResponse.json(
        { success: false, error: '缺少必要字段: process_name' },
        { status: 400 },
      )
    }

    const effectiveHashKey =
      generatedHashKey.length > 0 ? generatedHashKey : WEB_ADMIN_QUICK_ADD_DEVICE_HASH_KEY

    if (generatedHashKey.length > GENERATED_HASH_KEY_MAX_LENGTH) {
      return NextResponse.json(
        { success: false, error: 'GeneratedHashKey 长度不能超过 128' },
        { status: 400 },
      )
    }

    if (!generatedHashKey) {
      const now = sqlTimestamp()
      await db
        .insert(devices)
        .values({
          generatedHashKey: WEB_ADMIN_QUICK_ADD_DEVICE_HASH_KEY,
          displayName: 'Web (后台快速添加)',
          status: 'active',
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: devices.generatedHashKey,
          set: { status: 'active', updatedAt: now },
        })
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
          error:
            '设备不可用或不存在。请在「设备管理」中创建设备并复制 GeneratedHashKey，或使用留空以使用 Web 预留设备。',
        },
        { status: 403 },
      )
    }

    if (adminPersistSeconds != null && adminExpiresAt) {
      const now = sqlTimestamp()
      const expiresAtIso = adminExpiresAt.toISOString()
      await db
        .insert(userActivities)
        .values({
          deviceId: deviceRecord.id,
          generatedHashKey: effectiveHashKey,
          processName: process_name,
          processTitle: process_title,
          metadata: finalMetadata,
          expiresAt: expiresAtIso,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [userActivities.deviceId, userActivities.processName],
          set: {
            generatedHashKey: effectiveHashKey,
            processTitle: process_title,
            metadata: finalMetadata,
            expiresAt: expiresAtIso,
            updatedAt: now,
          },
        })
    } else {
      await db
        .delete(userActivities)
        .where(
          and(eq(userActivities.deviceId, deviceRecord.id), eq(userActivities.processName, process_name)),
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

    const seenAt = sqlTimestamp()
    await db
      .update(devices)
      .set({
        displayName: device || deviceRecord.displayName,
        lastSeenAt: seenAt,
        updatedAt: seenAt,
      })
      .where(eq(devices.id, deviceRecord.id))

    return NextResponse.json(
      {
        success: true,
        data: redactGeneratedHashKeyForClient(entry as unknown as Record<string, unknown>),
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('添加活动失败:', error)
    return NextResponse.json({ success: false, error: '添加失败' }, { status: 500 })
  }
}
