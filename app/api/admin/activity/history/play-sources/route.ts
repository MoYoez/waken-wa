import { and, desc, like } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

import { requireAdminSession, unauthorizedJson } from '@/lib/admin-api-auth'
import {
  ADMIN_LIST_DEFAULT_PAGE_SIZE,
  ADMIN_LIST_MAX_PAGE_SIZE,
} from '@/lib/admin-list-constants'
import { flushPendingReportedPlaySourceHistory } from '@/lib/activity-play-source-history'
import { db } from '@/lib/db'
import { activityPlaySourceHistory } from '@/lib/drizzle-schema'
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

    try {
      await flushPendingReportedPlaySourceHistory({ maxKeys: 300 })
    } catch {
      // ignore
    }

    const where =
      qRaw.length > 0
        ? and(like(activityPlaySourceHistory.playSource, `%${qRaw.toLowerCase()}%`))
        : undefined

    const rows = await db
      .select({
        playSource: activityPlaySourceHistory.playSource,
        lastSeenAt: activityPlaySourceHistory.lastSeenAt,
      })
      .from(activityPlaySourceHistory)
      .where(where as any)
      .orderBy(desc(activityPlaySourceHistory.lastSeenAt))
      .limit(limit)
      .offset(offset)

    return NextResponse.json({
      success: true,
      data: rows.map((row: { playSource: string; lastSeenAt: Date | string }) => ({
        playSource: row.playSource,
        lastSeenAt: row.lastSeenAt instanceof Date ? row.lastSeenAt.toISOString() : String(row.lastSeenAt ?? ''),
      })),
      pagination: { limit, offset, total: null },
    })
  } catch (error) {
    console.error('读取历史媒体来源记录失败:', error)
    return NextResponse.json({ success: false, error: '读取失败' }, { status: 500 })
  }
}
