import { desc } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import { flushPendingReportedAppHistory } from '@/lib/activity-app-history'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { activityAppHistory } from '@/lib/drizzle-schema'

async function requireAdmin() {
  const session = await getSession()
  return session ?? null
}

type Bucket = { titles: string[]; lastSeenAt: string | null }
type Buckets = { pc?: Bucket; mobile?: Bucket }

function parseBuckets(raw: unknown): Buckets | null {
  if (!raw) return null
  if (typeof raw === 'string') {
    try {
      const j = JSON.parse(raw)
      if (j && typeof j === 'object' && !Array.isArray(j)) return j as Buckets
      return null
    } catch {
      return null
    }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Buckets
  return null
}

export async function GET() {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ success: false, error: '未授权' }, { status: 401 })
  }

  try {
    // Best-effort flush so export is less stale.
    try {
      await flushPendingReportedAppHistory({ maxKeys: 500 })
    } catch {
      // ignore
    }

    const rows = await db
      .select({
        processName: activityAppHistory.processName,
        platformBuckets: activityAppHistory.platformBuckets,
        lastSeenAt: activityAppHistory.lastSeenAt,
      })
      .from(activityAppHistory)
      .orderBy(desc(activityAppHistory.lastSeenAt))
      .limit(5000)

    const pc: Array<{ appName: string; titles: string[]; lastSeenAt: string | null }> = []
    const mobile: Array<{ appName: string; titles: string[]; lastSeenAt: string | null }> = []

    for (const r of rows) {
      const buckets = parseBuckets(r.platformBuckets)
      const appName = String(r.processName ?? '').trim()
      if (!appName) continue
      const pcBucket = buckets?.pc
      const mobBucket = buckets?.mobile
      if (pcBucket) {
        pc.push({
          appName,
          titles: Array.isArray(pcBucket.titles) ? pcBucket.titles.slice(0, 3) : [],
          lastSeenAt: pcBucket.lastSeenAt ?? null,
        })
      }
      if (mobBucket) {
        mobile.push({
          appName,
          titles: Array.isArray(mobBucket.titles) ? mobBucket.titles.slice(0, 3) : [],
          lastSeenAt: mobBucket.lastSeenAt ?? null,
        })
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        version: 1,
        exportedAt: new Date().toISOString(),
        groups: { pc, mobile },
      },
    })
  } catch (error) {
    console.error('导出应用记录失败:', error)
    return NextResponse.json({ success: false, error: '导出失败' }, { status: 500 })
  }
}

