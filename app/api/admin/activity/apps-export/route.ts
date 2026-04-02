import { NextResponse } from 'next/server'

import { exportActivityAppsSnapshot } from '@/lib/activity-app-export'
import { getSession } from '@/lib/auth'

async function requireAdmin() {
  const session = await getSession()
  return session ?? null
}

export async function GET() {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ success: false, error: '未授权' }, { status: 401 })
  }

  try {
    return NextResponse.json({
      success: true,
      data: await exportActivityAppsSnapshot(),
    })
  } catch (error) {
    console.error('导出应用记录失败:', error)
    return NextResponse.json({ success: false, error: '导出失败' }, { status: 500 })
  }
}
