import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getActivityFeedData, getHistoryWindowMinutes } from '@/lib/activity-feed'

// 强制动态渲染，禁用缓存
export const dynamic = 'force-dynamic'
export const revalidate = 0

// 验证 API Token
async function validateToken(request: NextRequest): Promise<boolean> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return false
  }
  
  const token = authHeader.slice(7)
  const result = await prisma.apiToken.findFirst({
    where: { token, isActive: true }
  })
  
  if (result) {
    // 更新最后使用时间
    await prisma.apiToken.update({
      where: { id: result.id },
      data: { lastUsedAt: new Date() }
    })
  }
  
  return result !== null
}

// GET - 获取活动日志（公开）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')
    const device = searchParams.get('device')
    const historyWindowMinutes = await getHistoryWindowMinutes()
    const since = new Date(Date.now() - historyWindowMinutes * 60 * 1000)

    const where = device
      ? { device, startedAt: { gte: since } }
      : { startedAt: { gte: since } }

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        take: limit,
        skip: offset
      }),
      prisma.activityLog.count({ where })
    ])

    const feed = await getActivityFeedData(limit)

    return NextResponse.json({
      success: true,
      data: logs,
      pagination: { limit, offset, total },
      feed
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
    const isValid = await validateToken(request)
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: '无效的 API Token' },
        { status: 401 }
      )
    }
    
    const body = await request.json()
    const { device, process_name, process_title, metadata, report_interval_seconds } = body
    
    if (!device || !process_name) {
      return NextResponse.json(
        { success: false, error: '缺少必要字段: device, process_name' },
        { status: 400 }
      )
    }
    
    // 检查是否存在相同 device + process_name 的活动，如果存在则更新时间戳而非创建新记录
    const existing = await prisma.activityLog.findFirst({
      where: { device, processName: process_name, endedAt: null },
      orderBy: { startedAt: 'desc' }
    })
    
    if (existing) {
      // 更新现有活动的时间戳和上报间隔
      const log = await prisma.activityLog.update({
        where: { id: existing.id },
        data: {
          processTitle: process_title || existing.processTitle,
          metadata: metadata || existing.metadata,
          reportIntervalSeconds: report_interval_seconds || existing.reportIntervalSeconds,
          // 使用 updatedAt 字段来追踪最后上报时间
        }
      })
      return NextResponse.json({ success: true, data: log, updated: true }, { status: 200 })
    }
    
    // 结束该设备上其他进程的活动
    await prisma.activityLog.updateMany({
      where: { device, endedAt: null },
      data: { endedAt: new Date() },
    })

    const log = await prisma.activityLog.create({
      data: {
        device,
        processName: process_name,
        processTitle: process_title || null,
        startedAt: new Date(),
        endedAt: null,
        metadata: metadata || null,
        reportIntervalSeconds: report_interval_seconds || null
      }
    })
    
    return NextResponse.json({ success: true, data: log }, { status: 201 })
  } catch (error) {
    console.error('上报活动失败:', error)
    return NextResponse.json(
      { success: false, error: '上报活动失败' },
      { status: 500 }
    )
  }
}
