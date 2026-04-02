import { and, desc, like } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

import { flushPendingReportedAppHistory } from '@/lib/activity-app-history'
import { requireAdminSession, unauthorizedJson } from '@/lib/admin-api-auth'
import {
  ADMIN_LIST_DEFAULT_PAGE_SIZE,
  ADMIN_LIST_MAX_PAGE_SIZE,
} from '@/lib/admin-list-constants'
import { db } from '@/lib/db'
import { activityAppHistory } from '@/lib/drizzle-schema'
import { parsePaginationParams } from '@/lib/pagination'

export async function GET(request: NextRequest) {
  const session = await requireAdminSession()
  if (!session) {
    return unauthorizedJson()
  }

  try {
    const { searchParams } = new URL(request.url)
    const qRaw = String(searchParams.get('q') ?? '').trim()
    const { limit, offset } = parsePaginationParams(searchParams, {
      defaultLimit: ADMIN_LIST_DEFAULT_PAGE_SIZE,
      maxLimit: Math.max(ADMIN_LIST_MAX_PAGE_SIZE, 200),
    })

    // Best-effort flush so picker sees recent items.
    try {
      await flushPendingReportedAppHistory({ maxKeys: 300 })
    } catch {
      // ignore
    }

    const where = qRaw.length > 0
      ? and(like(activityAppHistory.processName, `%${qRaw.toLowerCase()}%`))
      : undefined

    const rows = await db
      .select({
        processName: activityAppHistory.processName,
        lastSeenAt: activityAppHistory.lastSeenAt,
      })
      .from(activityAppHistory)
      .where(where as any)
      .orderBy(desc(activityAppHistory.lastSeenAt))
      .limit(limit)
      .offset(offset)

    // count is optional for UI; keep response light
    return NextResponse.json({
      success: true,
      data: rows.map((r: { processName: string; lastSeenAt: Date | string }) => ({
        processName: r.processName,
        lastSeenAt: r.lastSeenAt instanceof Date ? r.lastSeenAt.toISOString() : String(r.lastSeenAt ?? ''),
      })),
      pagination: { limit, offset, total: null },
    })
  } catch (error) {
    console.error('读取历史应用记录失败:', error)
    return NextResponse.json({ success: false, error: '读取失败' }, { status: 500 })
  }
}

