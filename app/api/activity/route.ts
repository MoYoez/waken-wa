import { NextRequest, NextResponse } from 'next/server'
import { resolveActiveApiTokenFromPlainSecret } from '@/lib/api-token-secret'
import { getSession, isSiteLockSatisfied } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { getActivityFeedData } from '@/lib/activity-feed'
import {
  upsertActivity,
  redactGeneratedHashKeyForClient,
  USER_ACTIVITY_DB_SYNCED_METADATA_KEY,
  USER_PERSIST_EXPIRES_AT_METADATA_KEY,
} from '@/lib/activity-store'
import { mergeActivityMetadata } from '@/lib/activity-media'
import { persistMinutesToExpiresAt } from '@/lib/user-activity-persist'

// 强制动态渲染，禁用缓存
export const dynamic = 'force-dynamic'
export const revalidate = 0

async function validateToken(request: NextRequest): Promise<{ id: number } | null> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }
  return resolveActiveApiTokenFromPlainSecret(authHeader.slice(7))
}

// GET - 获取活动 feed
// 支持两种模式：
// 1. 管理员模式（需要 session）- 返回 feed 数据
// 2. 公开模式（?public=1）- 只返回 feed 数据，供客户端轮询使用
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const isPublicMode = searchParams.get('public') === '1'

    // 公开模式：只返回 feed 数据，但需要检查页面锁
    if (isPublicMode) {
      const siteLockOk = await isSiteLockSatisfied()
      if (!siteLockOk) {
        return NextResponse.json(
          { success: false, error: '请先解锁页面' },
          { status: 403 }
        )
      }
      const feed = await getActivityFeedData(50)
      return NextResponse.json({
        success: true,
        data: feed,
      })
    }

    // 管理员模式：需要认证
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ success: false, error: '未授权' }, { status: 401 })
    }

    const feed = await getActivityFeedData(50)
    return NextResponse.json({
      success: true,
      data: feed,
    })
  } catch (error) {
    console.error('获取活动日志失败:', error)
    return NextResponse.json(
      { success: false, error: '获取活动日志失败' },
      { status: 500 }
    )
  }
}

// POST - 上报活动（需要 API Token）
export async function POST(request: NextRequest) {
  try {
    const tokenInfo = await validateToken(request)
    if (!tokenInfo) {
      return NextResponse.json(
        { success: false, error: '无效的 API Token' },
        { status: 401 }
      )
    }
    
    const body = await request.json()
    const generatedHashKeyRaw = body?.generatedHashKey
    const deviceRaw = body?.device
    const processNameRaw = body?.process_name
    const processTitleRaw = body?.process_title
    const batteryRaw = body?.battery_level ?? body?.device_battery
    const deviceTypeRaw = body?.device_type
    const pushModeRaw = body?.push_mode
    const metadataRaw = body?.metadata

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

    if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
      delete (metadata as Record<string, unknown>)[USER_PERSIST_EXPIRES_AT_METADATA_KEY]
      delete (metadata as Record<string, unknown>)[USER_ACTIVITY_DB_SYNCED_METADATA_KEY]
    }

    const persistMinutesRaw = body?.persist_minutes ?? body?.persistMinutes

    if (!generatedHashKey || !process_name) {
      return NextResponse.json(
        { success: false, error: '缺少必要字段: generatedHashKey, process_name' },
        { status: 400 }
      )
    }

    // 验证设备
    let deviceRecord = await (prisma as any).device.findUnique({
      where: { generatedHashKey },
    })

    if (!deviceRecord) {
      const config = await (prisma as any).siteConfig.findUnique({ where: { id: 1 } })
      const autoAccept = Boolean(config?.autoAcceptNewDevices)
      const createdStatus = autoAccept ? 'active' : 'pending'
      deviceRecord = await (prisma as any).device.create({
        data: {
          generatedHashKey,
          displayName: device || 'Unknown Device',
          status: createdStatus,
          apiTokenId: tokenInfo.id,
          lastSeenAt: autoAccept ? new Date() : null,
        },
      })

      if (!autoAccept) {
        return NextResponse.json(
          { success: false, error: '设备待后台审核后可用', pending: true },
          { status: 202 }
        )
      }
    }

    if (deviceRecord.status === 'pending') {
      return NextResponse.json(
        { success: false, error: '设备待后台审核后可用', pending: true },
        { status: 202 }
      )
    }

    if (deviceRecord.status !== 'active') {
      return NextResponse.json(
        { success: false, error: '设备不可用或不存在' },
        { status: 403 }
      )
    }
    if (deviceRecord.apiTokenId && deviceRecord.apiTokenId !== tokenInfo.id) {
      return NextResponse.json(
        { success: false, error: '该设备未绑定当前 Token' },
        { status: 403 }
      )
    }

    const pushModeNorm = String((metadata as Record<string, unknown> | null)?.pushMode ?? '')
      .trim()
      .toLowerCase()
    const isActivePush = pushModeNorm === 'active' || pushModeNorm === 'persistent'
    const expiresAt = persistMinutesToExpiresAt(persistMinutesRaw)

    let finalMetadata = metadata
    if (isActivePush && expiresAt) {
      finalMetadata = {
        ...(finalMetadata || {}),
        pushMode: 'active',
        [USER_PERSIST_EXPIRES_AT_METADATA_KEY]: expiresAt.toISOString(),
        [USER_ACTIVITY_DB_SYNCED_METADATA_KEY]: true,
      }
      await (prisma as any).userActivity.upsert({
        where: {
          deviceId_processName: {
            deviceId: deviceRecord.id,
            processName: process_name,
          },
        },
        create: {
          deviceId: deviceRecord.id,
          generatedHashKey,
          processName: process_name,
          processTitle: process_title,
          metadata: finalMetadata ?? undefined,
          expiresAt,
        },
        update: {
          generatedHashKey,
          processTitle: process_title,
          metadata: finalMetadata ?? undefined,
          expiresAt,
        },
      })
    } else {
      await (prisma as any).userActivity.deleteMany({
        where: { deviceId: deviceRecord.id, processName: process_name },
      })
      finalMetadata = { ...(finalMetadata || {}) }
      // Non-realtime without persist_minutes would never stale; fall back to realtime.
      if (isActivePush && !expiresAt) {
        finalMetadata.pushMode = 'realtime'
      }
    }

    // Store in memory (primary cache)
    const entry = upsertActivity({
      device,
      generatedHashKey,
      deviceId: deviceRecord.id,
      processName: process_name,
      processTitle: process_title,
      metadata: finalMetadata,
    })

    // 更新设备最后在线时间
    await (prisma as any).device.update({
      where: { id: deviceRecord.id },
      data: { displayName: device || deviceRecord.displayName, lastSeenAt: new Date() },
    })

    return NextResponse.json({
      success: true,
      data: redactGeneratedHashKeyForClient(entry as unknown as Record<string, unknown>),
    }, { status: 200 })
  } catch (error) {
    console.error('上报活动失败:', error)
    return NextResponse.json(
      { success: false, error: '上报活动失败' },
      { status: 500 }
    )
  }
}
