import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'

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
    const device = searchParams.get('device')
    const search = searchParams.get('search')
    
    const where: Prisma.ActivityLogWhereInput = {}
    
    if (device) {
      where.device = device
    }
    
    if (search) {
      where.OR = [
        { processName: { contains: search, mode: 'insensitive' } },
        { processTitle: { contains: search, mode: 'insensitive' } }
      ]
    }
    
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
    const { device, process_name, process_title, metadata } = body
    
    if (!device || !process_name) {
      return NextResponse.json(
        { success: false, error: '缺少必要字段' },
        { status: 400 }
      )
    }
    
    await prisma.activityLog.updateMany({
      where: { device, endedAt: null },
      data: { endedAt: new Date() }
    })

    const log = await prisma.activityLog.create({
      data: {
        device,
        processName: process_name,
        processTitle: process_title || null,
        startedAt: new Date(),
        endedAt: null,
        metadata: metadata || null
      }
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
