import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

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
    
    const where = device ? { device } : {}
    
    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        take: limit,
        skip: offset
      }),
      prisma.activityLog.count({ where })
    ])
    
    return NextResponse.json({
      success: true,
      data: logs,
      pagination: { limit, offset, total }
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
    const { device, process_name, process_title, started_at, ended_at, metadata } = body
    
    if (!device || !process_name) {
      return NextResponse.json(
        { success: false, error: '缺少必要字段: device, process_name' },
        { status: 400 }
      )
    }
    
    const log = await prisma.activityLog.create({
      data: {
        device,
        processName: process_name,
        processTitle: process_title || null,
        startedAt: started_at ? new Date(started_at) : new Date(),
        endedAt: ended_at ? new Date(ended_at) : null,
        metadata: metadata || null
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
