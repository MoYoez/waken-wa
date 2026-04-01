import { and, desc, like } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

import { flushPendingReportedAppHistory } from '@/lib/activity-app-history'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { activityAppHistory } from '@/lib/drizzle-schema'

async function requireAdmin() {
  const session = await getSession()
  return session ?? null
}

export async function GET(request: NextRequest) {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ success: false, error: '未授权' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const qRaw = String(searchParams.get('q') ?? '').trim()
    const limitRaw = Number(searchParams.get('limit') ?? 50)
    const offsetRaw = Number(searchParams.get('offset') ?? 0)
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, Math.round(limitRaw))) : 50
    const offset = Number.isFinite(offsetRaw) ? Math.max(0, Math.round(offsetRaw)) : 0

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

