/** Inclusive bounds for SiteConfig.activityLogRetentionMax when retention is enabled. */
export const ACTIVITY_LOG_RETENTION_MIN = 1
export const ACTIVITY_LOG_RETENTION_MAX = 1500

export type ActivityLogRetentionMaxParseResult =
  | { kind: 'omit' }
  | { kind: 'set'; value: number | null }
  | { kind: 'error'; error: string }

/**
 * Normalize PATCH body field: omit = leave DB unchanged; set null = unlimited; set number = cap.
 */
export function parseActivityLogRetentionMaxInput(raw: unknown): ActivityLogRetentionMaxParseResult {
  if (raw === undefined) {
    return { kind: 'omit' }
  }
  if (raw === null) {
    return { kind: 'set', value: null }
  }
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n)) {
    return { kind: 'error', error: 'activityLogRetentionMax 须为数字、null（无限制）或省略' }
  }
  const rounded = Math.round(n)
  if (rounded < ACTIVITY_LOG_RETENTION_MIN || rounded > ACTIVITY_LOG_RETENTION_MAX) {
    return {
      kind: 'error',
      error: `activityLogRetentionMax 须在 ${ACTIVITY_LOG_RETENTION_MIN}–${ACTIVITY_LOG_RETENTION_MAX} 之间，或使用 null 表示无限制`,
    }
  }
  return { kind: 'set', value: rounded }
}

/**
 * After a new activity_logs row is inserted: if site cap is set, delete oldest rows so total count <= max.
 */
export async function pruneActivityLogsToMax(
  prismaClient: { activityLog: { count: Function; findMany: Function; deleteMany: Function } },
  max: number | null,
): Promise<void> {
  if (max == null) return
  if (max < ACTIVITY_LOG_RETENTION_MIN || max > ACTIVITY_LOG_RETENTION_MAX) return

  const total = await prismaClient.activityLog.count()
  if (total <= max) return

  const toDelete = total - max
  const oldest = await prismaClient.activityLog.findMany({
    select: { id: true },
    orderBy: { id: 'asc' },
    take: toDelete,
  })
  const ids = oldest.map((r: { id: number }) => r.id)
  if (ids.length === 0) return

  await prismaClient.activityLog.deleteMany({
    where: { id: { in: ids } },
  })
}

/** Load cap from site_config id=1 and prune if needed (call after activityLog.create). */
export async function pruneActivityLogsAfterInsert(prismaClient: {
  siteConfig: { findUnique: Function }
  activityLog: { count: Function; findMany: Function; deleteMany: Function }
}): Promise<void> {
  const row = await prismaClient.siteConfig.findUnique({
    where: { id: 1 },
    select: { activityLogRetentionMax: true },
  })
  const max =
    row?.activityLogRetentionMax != null && Number.isFinite(Number(row.activityLogRetentionMax))
      ? Number(row.activityLogRetentionMax)
      : null
  await pruneActivityLogsToMax(prismaClient, max)
}
