import { gt } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import { getSession, isSiteLockSatisfied } from '@/lib/auth'
import { db } from '@/lib/db'
import { userActivities } from '@/lib/drizzle-schema'
import { listRealtimeActivities } from '@/lib/realtime-activity-cache'
import { sqlTimestamp } from '@/lib/sql-timestamp'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const session = await getSession()
    if (!session && !(await isSiteLockSatisfied())) {
      return NextResponse.json(
        { success: false, error: 'Please unlock the page first' },
        { status: 403 },
      )
    }

    const now = sqlTimestamp()
    const [activeRow] = await db
      .select({ id: userActivities.id })
      .from(userActivities)
      .where(gt(userActivities.expiresAt, now))
      .limit(1)

    let isOnline = !!activeRow

    if (!isOnline) {
      const realtimeRows = await listRealtimeActivities()
      isOnline = realtimeRows.length > 0
    }

    return NextResponse.json(
      { success: true, data: { isOnline } },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    console.error('Failed to read user status:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to read user status' },
      { status: 500 },
    )
  }
}
