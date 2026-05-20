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
    console.error('Failed to export app records:', error)
    return NextResponse.json({ success: false, error: 'Failed to export' }, { status: 500 })
  }
}
