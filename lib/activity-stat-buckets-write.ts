import 'server-only'

import { and, eq, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { activityStatBuckets } from '@/lib/drizzle-schema'
import { getSiteConfigMemoryFirst } from '@/lib/site-config-cache'
import { sqlDate, sqlTimestamp } from '@/lib/sql-timestamp'
import { getDateParts, normalizeTimezone } from '@/lib/timezone'
import type { PendingHistoryEntry } from '@/types/activity-history-pending'

type BucketGrain = {
  statDate: string
  hourOfDay: number
  kind: 'app' | 'play_source'
  entryKey: string
  platform: string
  hitCount: number
  firstSeenAtMs: number
  lastSeenAtMs: number
}

function pad2(value: number): string {
  return String(Math.max(0, Math.trunc(value))).padStart(2, '0')
}

function GrainKey(grain: Omit<BucketGrain, 'hitCount' | 'firstSeenAtMs' | 'lastSeenAtMs'>): string {
  return `${grain.statDate}|${grain.hourOfDay}|${grain.kind}|${grain.entryKey}|${grain.platform}`
}

function ResolveSeenAtMs(seenAt: string): number {
  const parsed = Date.parse(String(seenAt ?? ''))
  return Number.isFinite(parsed) ? parsed : Date.now()
}

/**
 * Aggregate pending history entries into per-day/per-hour buckets keyed by the
 * site display timezone, then upsert with an atomic hit-count increment.
 * Best-effort: failures never block the history flush.
 */
export async function WriteActivityStatBuckets(entries: PendingHistoryEntry[]): Promise<void> {
  if (entries.length === 0) return

  const cfg = await getSiteConfigMemoryFirst()
  const timezone = normalizeTimezone(cfg?.displayTimezone)

  const grains = new Map<string, BucketGrain>()
  for (const entry of entries) {
    const seenAtMs = ResolveSeenAtMs(entry.seenAt)
    const parts = getDateParts(seenAtMs, timezone)
    const statDate = `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`
    const hourOfDay = Math.max(0, Math.min(23, Math.trunc(parts.hour)))
    const kind: 'app' | 'play_source' = entry.kind === 'app' ? 'app' : 'play_source'
    const entryKey = entry.kind === 'app' ? entry.processName : entry.playSource
    if (!entryKey) continue
    const platform = entry.kind === 'app' ? entry.platform : ''
    const identity = { statDate, hourOfDay, kind, entryKey, platform }
    const key = GrainKey(identity)
    const existing = grains.get(key)
    if (existing) {
      existing.hitCount += 1
      existing.firstSeenAtMs = Math.min(existing.firstSeenAtMs, seenAtMs)
      existing.lastSeenAtMs = Math.max(existing.lastSeenAtMs, seenAtMs)
      continue
    }
    grains.set(key, {
      ...identity,
      hitCount: 1,
      firstSeenAtMs: seenAtMs,
      lastSeenAtMs: seenAtMs,
    })
  }

  for (const grain of grains.values()) {
    const firstSeenAt = sqlDate(new Date(grain.firstSeenAtMs))
    const lastSeenAt = sqlDate(new Date(grain.lastSeenAtMs))
    await db
      .insert(activityStatBuckets)
      .values({
        statDate: grain.statDate,
        hourOfDay: grain.hourOfDay,
        kind: grain.kind,
        entryKey: grain.entryKey,
        platform: grain.platform,
        hitCount: grain.hitCount,
        firstSeenAt,
        lastSeenAt,
        updatedAt: sqlTimestamp(),
      } as any)
      .onConflictDoUpdate({
        target: [
          activityStatBuckets.statDate,
          activityStatBuckets.hourOfDay,
          activityStatBuckets.kind,
          activityStatBuckets.entryKey,
          activityStatBuckets.platform,
        ],
        set: {
          hitCount: sql`${activityStatBuckets.hitCount} + ${grain.hitCount}`,
          lastSeenAt,
          updatedAt: sqlTimestamp(),
        },
      })
      .catch(async () => {
        // Fallback for drivers that reject the composite upsert target: read-modify-write.
        const [row] = await db
          .select({ id: activityStatBuckets.id, hitCount: activityStatBuckets.hitCount })
          .from(activityStatBuckets)
          .where(
            and(
              eq(activityStatBuckets.statDate, grain.statDate),
              eq(activityStatBuckets.hourOfDay, grain.hourOfDay),
              eq(activityStatBuckets.kind, grain.kind),
              eq(activityStatBuckets.entryKey, grain.entryKey),
              eq(activityStatBuckets.platform, grain.platform),
            ),
          )
          .limit(1)
        if (row) {
          await db
            .update(activityStatBuckets)
            .set({
              hitCount: Number(row.hitCount ?? 0) + grain.hitCount,
              lastSeenAt,
              updatedAt: sqlTimestamp(),
            })
            .where(eq(activityStatBuckets.id, row.id))
        }
      })
  }
}
