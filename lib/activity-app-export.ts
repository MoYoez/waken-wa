import { desc } from 'drizzle-orm'

import { flushPendingReportedAppHistory } from '@/lib/activity-app-history'
import { db } from '@/lib/db'
import { activityAppHistory } from '@/lib/drizzle-schema'

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

export async function exportActivityAppsSnapshot() {
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

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    groups: { pc, mobile },
  }
}
