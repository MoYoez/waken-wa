import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { WEB_ADMIN_QUICK_ADD_DEVICE_HASH_KEY } from '@/lib/device-constants'
import {
  ADMIN_PERSIST_SECONDS_METADATA_KEY,
  USER_ACTIVITY_DB_SYNCED_METADATA_KEY,
  USER_PERSIST_EXPIRES_AT_METADATA_KEY,
  upsertActivity,
  redactGeneratedHashKeyForClient,
} from '@/lib/activity-store'

// 强制动态渲染，禁用缓存
export const dynamic = 'force-dynamic'
export const revalidate = 0

// 检查管理员权限
async function requireAdmin() {
  const session = await getSession()
  if (!session) return null
  return session
}

// POST - 手动添加活动（写入内存 activity-store，与公开上报一致）
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
      if (metaKeys.length > 50 || JSON.stringify(metadata).length > 10240) {
        return NextResponse.json(
          { success: false, error: 'metadata 数据过大' },
          { status: 400 },
        )
      }
    }
    if (typeof batteryRaw === 'number' && Number.isFinite(batteryRaw)) {
      const batteryLevel = Math.min(Math.max(Math.round(batteryRaw), 0), 100)
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

    const STALE_MIN_SEC = 30
    const STALE_MAX_SEC = 24 * 60 * 60
    let adminPersistSeconds: number | undefined
    if (persistMinutesRaw !== undefined && persistMinutesRaw !== null) {
      const mins = Number(persistMinutesRaw)
      if (Number.isFinite(mins) && mins > 0) {
        const sec = Math.round(mins * 60)
        adminPersistSeconds = Math.min(Math.max(sec, STALE_MIN_SEC), STALE_MAX_SEC)
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
        { status: 400 }
      )
    }

    const effectiveHashKey =
      generatedHashKey.length > 0 ? generatedHashKey : WEB_ADMIN_QUICK_ADD_DEVICE_HASH_KEY

    if (generatedHashKey.length > 128) {
      return NextResponse.json(
        { success: false, error: 'GeneratedHashKey 长度不能超过 128' },
        { status: 400 }
      )
    }

    if (!generatedHashKey) {
      await (prisma as any).device.upsert({
        where: { generatedHashKey: WEB_ADMIN_QUICK_ADD_DEVICE_HASH_KEY },
        create: {
          generatedHashKey: WEB_ADMIN_QUICK_ADD_DEVICE_HASH_KEY,
          displayName: 'Web (后台快速添加)',
          status: 'active',
        },
        update: {
          status: 'active',
        },
      })
    }

    const deviceRecord = await (prisma as any).device.findUnique({
      where: { generatedHashKey: effectiveHashKey },
    })
    if (!deviceRecord || deviceRecord.status !== 'active') {
      return NextResponse.json(
        {
          success: false,
          error:
            '设备不可用或不存在。请在「设备管理」中创建设备并复制 GeneratedHashKey，或使用留空以使用 Web 预留设备。',
        },
        { status: 403 }
      )
    }

    if (adminPersistSeconds != null && adminExpiresAt) {
      await (prisma as any).userActivity.upsert({
        where: {
          deviceId_processName: {
            deviceId: deviceRecord.id,
            processName: process_name,
          },
        },
        create: {
          deviceId: deviceRecord.id,
          generatedHashKey: effectiveHashKey,
          processName: process_name,
          processTitle: process_title,
          metadata: finalMetadata ?? undefined,
          expiresAt: adminExpiresAt,
        },
        update: {
          generatedHashKey: effectiveHashKey,
          processTitle: process_title,
          metadata: finalMetadata ?? undefined,
          expiresAt: adminExpiresAt,
        },
      })
    } else {
      await (prisma as any).userActivity.deleteMany({
        where: { deviceId: deviceRecord.id, processName: process_name },
      })
    }

    const entry = upsertActivity({
      device,
      generatedHashKey: effectiveHashKey,
      deviceId: deviceRecord.id,
      processName: process_name,
      processTitle: process_title,
      metadata: finalMetadata,
    })

    await (prisma as any).device.update({
      where: { id: deviceRecord.id },
      data: { displayName: device || deviceRecord.displayName, lastSeenAt: new Date() },
    })

    return NextResponse.json(
      {
        success: true,
        data: redactGeneratedHashKeyForClient(entry as unknown as Record<string, unknown>),
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('添加活动失败:', error)
    return NextResponse.json({ success: false, error: '添加失败' }, { status: 500 })
  }
}
