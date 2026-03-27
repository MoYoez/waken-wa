import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { WEB_ADMIN_QUICK_ADD_DEVICE_HASH_KEY } from '@/lib/device-constants'

// 强制动态渲染，禁用缓存
export const dynamic = 'force-dynamic'
export const revalidate = 0

// 检查管理员权限
async function requireAdmin() {
  const session = await getSession()
  if (!session) return null
  return session
}

// GET - 获取活动日志（管理员）
export async function GET(request: NextRequest) {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ success: false, error: '未授权' }, { status: 401 })
  }
  
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')
    const generatedHashKey = String(searchParams.get('generatedHashKey') ?? '').trim()
    const search = searchParams.get('search')
    
    const where: Prisma.ActivityLogWhereInput = {}
    
    if (generatedHashKey) {
      ;(where as any).generatedHashKey = generatedHashKey
    }
    
    if (search) {
      where.OR = [
        { processName: { contains: search, mode: 'insensitive' } },
        { processTitle: { contains: search, mode: 'insensitive' } }
      ]
    }
    
    const [logs, total] = await Promise.all([
      (prisma as any).activityLog.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        take: limit,
        skip: offset
      }),
      (prisma as any).activityLog.count({ where })
    ])
    
    return NextResponse.json({
      success: true,
      data: logs,
      pagination: { limit, offset, total }
    })
  } catch (error) {
    console.error('获取活动日志失败:', error)
    return NextResponse.json({ success: false, error: '获取失败' }, { status: 500 })
  }
}

// POST - 手动添加活动
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
    const metadataInput = metadata as Prisma.InputJsonValue | undefined

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

    await (prisma as any).activityLog.updateMany({
      where: { generatedHashKey: effectiveHashKey, endedAt: null },
      data: { endedAt: new Date() },
    })

    const log = await (prisma as any).activityLog.create({
      data: {
        device,
        generatedHashKey: effectiveHashKey,
        deviceId: deviceRecord.id,
        processName: process_name,
        processTitle: process_title || null,
        startedAt: new Date(),
        endedAt: null,
        metadata: metadataInput
      }
    })
    await (prisma as any).device.update({
      where: { id: deviceRecord.id },
      data: { displayName: device || deviceRecord.displayName, lastSeenAt: new Date() },
    })
    
    return NextResponse.json({ success: true, data: log }, { status: 201 })
  } catch (error) {
    console.error('添加活动失败:', error)
    return NextResponse.json({ success: false, error: '添加失败' }, { status: 500 })
  }
}

// DELETE - 删除活动
export async function DELETE(request: NextRequest) {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ success: false, error: '未授权' }, { status: 401 })
  }
  
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json({ success: false, error: '缺少 ID' }, { status: 400 })
    }
    
    await prisma.activityLog.delete({
      where: { id: parseInt(id) }
    })
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('删除活动失败:', error)
    return NextResponse.json({ success: false, error: '删除失败' }, { status: 500 })
  }
}
