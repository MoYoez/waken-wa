import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ success: false, error: '未授权' }, { status: 401 })
  }
  
  try {
    // 总活动数
    const totalActivities = await prisma.activityLog.count()
    
    // 今日活动数
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayActivities = await prisma.activityLog.count({
      where: { startedAt: { gte: today } }
    })
    
    // 设备数量
    const devices = await prisma.activityLog.findMany({
      distinct: ['device'],
      select: { device: true }
    })
    const totalDevices = devices.length
    
    // 活跃 Token 数
    const activeTokens = await prisma.apiToken.count({
      where: { isActive: true }
    })
    
    const deviceGroups = await prisma.activityLog.groupBy({
      by: ['device'],
      _max: { startedAt: true },
      _count: { _all: true }
    })
    const recentDevices = deviceGroups
      .sort((a, b) => {
        const ta = a._max.startedAt?.getTime() ?? 0
        const tb = b._max.startedAt?.getTime() ?? 0
        return tb - ta
      })
      .slice(0, 5)
      .map((row) => ({
        device: row.device,
        last_used: row._max.startedAt,
        count: String(row._count._all)
      }))

    const processGroups = await prisma.activityLog.groupBy({
      by: ['processName'],
      _count: { _all: true }
    })
    const topProcesses = processGroups
      .sort((a, b) => b._count._all - a._count._all)
      .slice(0, 5)
      .map((row) => ({
        process_name: row.processName,
        count: String(row._count._all)
      }))
    
    return NextResponse.json({
      success: true,
      data: {
        totalActivities,
        todayActivities,
        totalDevices,
        activeTokens,
        recentDevices,
        topProcesses
      }
    })
  } catch (error) {
    console.error('获取统计失败:', error)
    return NextResponse.json({ success: false, error: '获取失败' }, { status: 500 })
  }
}
