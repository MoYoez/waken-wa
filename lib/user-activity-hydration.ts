import { count, eq, gt, lte } from 'drizzle-orm'

import {
  removeActivityStoreEntry,
  upsertActivity,
  USER_ACTIVITY_DB_SYNCED_METADATA_KEY,
  USER_PERSIST_EXPIRES_AT_METADATA_KEY,
} from '@/lib/activity-store'
import { db } from '@/lib/db'
import { sqlTimestamp } from '@/lib/sql-timestamp'
import { devices, userActivities } from '@/lib/drizzle-schema'

let userActivityHydratedFromDb = false

/**
 * Delete expired UserActivity rows and remove matching keys from the in-memory store.
 */
export async function purgeExpiredUserActivitiesFromDbAndMemory(): Promise<void> {
  const now = sqlTimestamp()
  const expired = await db
    .select({
      generatedHashKey: userActivities.generatedHashKey,
      processName: userActivities.processName,
    })
    .from(userActivities)
    .where(lte(userActivities.expiresAt, now))
  if (expired.length === 0) return

  await db.delete(userActivities).where(lte(userActivities.expiresAt, now))

  for (const row of expired) {
    removeActivityStoreEntry(row.generatedHashKey, row.processName)
  }
}

function mergeMetadataForHydrate(
  stored: unknown,
  expiresAt: Date,
): Record<string, unknown> {
  const base =
    stored && typeof stored === 'object' && !Array.isArray(stored)
      ? { ...(stored as Record<string, unknown>) }
      : {}
  base.pushMode = 'active'
  base[USER_PERSIST_EXPIRES_AT_METADATA_KEY] = expiresAt.toISOString()
  base[USER_ACTIVITY_DB_SYNCED_METADATA_KEY] = true
  return base
}

/**
 * Once per process: if any non-expired UserActivity exists, load all into memory.
 * If none exist, mark done without a heavy findMany (single count only).
 */
export async function hydrateUserActivitiesIntoStoreOnce(): Promise<void> {
  if (userActivityHydratedFromDb) return

  const now = sqlTimestamp()
  const [cntRow] = await db
    .select({ c: count() })
    .from(userActivities)
    .where(gt(userActivities.expiresAt, now))
  const activeCount = Number(cntRow?.c ?? 0)

  if (activeCount === 0) {
    userActivityHydratedFromDb = true
    return
  }

  const rows = await db
    .select({
      deviceId: userActivities.deviceId,
      generatedHashKey: userActivities.generatedHashKey,
      processName: userActivities.processName,
      processTitle: userActivities.processTitle,
      metadata: userActivities.metadata,
      startedAt: userActivities.startedAt,
      expiresAt: userActivities.expiresAt,
      displayName: devices.displayName,
    })
    .from(userActivities)
    .innerJoin(devices, eq(userActivities.deviceId, devices.id))
    .where(gt(userActivities.expiresAt, now))

  for (const row of rows) {
    upsertActivity(
      {
        device: row.displayName,
        generatedHashKey: row.generatedHashKey,
        deviceId: row.deviceId,
        processName: row.processName,
        processTitle: row.processTitle,
        metadata: mergeMetadataForHydrate(row.metadata, row.expiresAt),
      },
      { startedAtOverride: row.startedAt, skipEndOtherProcessesOnDevice: true },
    )
  }

  userActivityHydratedFromDb = true
}

/** For tests or rare admin use only */
export function resetUserActivityHydrationFlagForTests(): void {
  userActivityHydratedFromDb = false
}
