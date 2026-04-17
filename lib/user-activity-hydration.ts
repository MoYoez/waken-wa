import { lte } from 'drizzle-orm'

import { db } from '@/lib/db'
import { userActivities } from '@/lib/drizzle-schema'
import { sqlTimestamp } from '@/lib/sql-timestamp'

const PURGE_EXPIRED_USER_ACTIVITIES_INTERVAL_MS = 30 * 1000

let lastPurgeAtMs = 0
let purgeInFlight: Promise<void> | null = null

/**
 * Delete expired UserActivity rows. Online-state source of truth is Redis/DB;
 * process-local in-memory hydration is intentionally disabled for serverless consistency.
 */
export async function purgeExpiredUserActivitiesFromDbAndMemory(): Promise<void> {
  const nowMs = Date.now()
  if (nowMs - lastPurgeAtMs < PURGE_EXPIRED_USER_ACTIVITIES_INTERVAL_MS) {
    return
  }
  if (purgeInFlight) {
    return purgeInFlight
  }

  const now = sqlTimestamp()
  purgeInFlight = db
    .delete(userActivities)
    .where(lte(userActivities.expiresAt, now))
    .then(() => {
      lastPurgeAtMs = Date.now()
    })
    .finally(() => {
      purgeInFlight = null
    })

  return purgeInFlight
}

/**
 * No-op by design. Keep signature for existing call sites.
 */
export async function hydrateUserActivitiesIntoStoreOnce(): Promise<void> {
  return
}

/** For tests or rare admin use only */
export function resetUserActivityHydrationFlagForTests(): void {
  lastPurgeAtMs = 0
  purgeInFlight = null
}
