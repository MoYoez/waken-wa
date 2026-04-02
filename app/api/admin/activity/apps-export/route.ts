import { NextResponse } from 'next/server'

import { exportActivityAppsSnapshot } from '@/lib/activity-app-export'
import { requireAdminSession, unauthorizedJson } from '@/lib/admin-api-auth'

export async function GET() {
  const session = await requireAdminSession()
  if (!session) {
    return unauthorizedJson()
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
