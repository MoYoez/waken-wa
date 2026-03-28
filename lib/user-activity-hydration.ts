import {
  removeActivityStoreEntry,
  upsertActivity,
  USER_ACTIVITY_DB_SYNCED_METADATA_KEY,
  USER_PERSIST_EXPIRES_AT_METADATA_KEY,
} from '@/lib/activity-store'

let userActivityHydratedFromDb = false

/**
 * Delete expired UserActivity rows and remove matching keys from the in-memory store.
 */
export async function purgeExpiredUserActivitiesFromDbAndMemory(prismaClient: {
  userActivity: {
    findMany: (args: unknown) => Promise<
      Array<{ generatedHashKey: string; processName: string }>
    >
    deleteMany: (args: unknown) => Promise<unknown>
  }
}): Promise<void> {
  const now = new Date()
  const expired = await prismaClient.userActivity.findMany({
    where: { expiresAt: { lte: now } },
    select: { generatedHashKey: true, processName: true },
  })
  if (expired.length === 0) return

  await prismaClient.userActivity.deleteMany({
    where: { expiresAt: { lte: now } },
  })

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
export async function hydrateUserActivitiesIntoStoreOnce(prismaClient: {
  userActivity: {
    count: (args: unknown) => Promise<number>
    findMany: (args: unknown) => Promise<
      Array<{
        deviceId: number
        generatedHashKey: string
        processName: string
        processTitle: string | null
        metadata: unknown
        startedAt: Date
        expiresAt: Date
        device: { displayName: string }
      }>
    >
  }
}): Promise<void> {
  if (userActivityHydratedFromDb) return

  const now = new Date()
  const activeCount = await prismaClient.userActivity.count({
    where: { expiresAt: { gt: now } },
  })

  if (activeCount === 0) {
    userActivityHydratedFromDb = true
    return
  }

  const rows = await prismaClient.userActivity.findMany({
    where: { expiresAt: { gt: now } },
    include: { device: { select: { displayName: true } } },
  })

  for (const row of rows) {
    upsertActivity(
      {
        device: row.device.displayName,
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
