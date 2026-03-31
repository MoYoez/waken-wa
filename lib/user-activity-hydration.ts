import { lte } from 'drizzle-orm'

import { db } from '@/lib/db'
import { userActivities } from '@/lib/drizzle-schema'
import { sqlTimestamp } from '@/lib/sql-timestamp'

/**
 * Delete expired UserActivity rows. Online-state source of truth is Redis/DB;
 * process-local in-memory hydration is intentionally disabled for serverless consistency.
 */
export async function purgeExpiredUserActivitiesFromDbAndMemory(): Promise<void> {
  const now = sqlTimestamp()
  await db.delete(userActivities).where(lte(userActivities.expiresAt, now))
}

/**
 * No-op by design. Keep signature for existing call sites.
 */
export async function hydrateUserActivitiesIntoStoreOnce(): Promise<void> {
  return
}

/** For tests or rare admin use only */
export function resetUserActivityHydrationFlagForTests(): void {
  return
}
