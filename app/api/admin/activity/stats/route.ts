import { NextRequest, NextResponse } from 'next/server'

import { NormalizeActivityStatsRangeDays } from '@/constants/activity-stats'
import { BuildActivityStats } from '@/lib/activity-stats-query'
import { requireAdminSession, unauthorizedJson } from '@/lib/admin-api-auth'

export async function GET(request: NextRequest) {
  const session = await requireAdminSession()
  if (!session) {
    return unauthorizedJson()
  }

  try {
    const { searchParams } = new URL(request.url)
    const rangeDays = NormalizeActivityStatsRangeDays(searchParams.get('days'))
    const data = await BuildActivityStats(rangeDays)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Failed to build activity stats:', error)
    return NextResponse.json({ success: false, error: 'Failed to read' }, { status: 500 })
  }
}
