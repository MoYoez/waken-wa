import type {
  ActivityEntry,
  UpsertActivityOptions,
  UpsertActivityPayload,
} from '@/types/activity'

/** Admin quick-add silence window (server-only metadata; stripped for clients). */
export const ADMIN_PERSIST_SECONDS_METADATA_KEY = 'adminPersistSeconds' as const
/** Client persist: absolute expiry ISO (server-only; stripped for clients). */
export const USER_PERSIST_EXPIRES_AT_METADATA_KEY = 'userPersistExpiresAt' as const
/** Set when a UserActivity row exists for this slot (server-only; stripped). */
export const USER_ACTIVITY_DB_SYNCED_METADATA_KEY = 'userActivityDbSynced' as const

export type { ActivityEntry, UpsertActivityOptions } from '@/types/activity'

let idCounter = 0
function generateId(): string {
  return `activity_${Date.now()}_${++idCounter}`
}

export function upsertActivity(
  data: UpsertActivityPayload,
  options?: UpsertActivityOptions,
): ActivityEntry {
  const now = new Date()
  const startedAt = options?.startedAtOverride ?? now

  return {
    id: generateId(),
    device: data.device,
    generatedHashKey: data.generatedHashKey,
    deviceId: data.deviceId,
    processName: data.processName,
    processTitle: data.processTitle,
    startedAt,
    updatedAt: now,
    endedAt: null,
    metadata: data.metadata,
  }
}

export function removeActivityStoreEntry(generatedHashKey: string, processName: string): void {
  void generatedHashKey
  void processName
}

export function getAllActivities(): ActivityEntry[] {
  return []
}

export function cleanupStaleActivities(staleSeconds: number): void {
  void staleSeconds
}

/** Strip device secrets and internal metadata keys before sending to clients. */
export function redactGeneratedHashKeyForClient(row: Record<string, unknown>): Record<string, unknown> {
  const { generatedHashKey: _omit, ...rest } = row
  const out: Record<string, unknown> = { ...rest }
  if (out.metadata && typeof out.metadata === 'object' && !Array.isArray(out.metadata)) {
    const m = { ...(out.metadata as Record<string, unknown>) }
    delete m[ADMIN_PERSIST_SECONDS_METADATA_KEY]
    delete m[USER_PERSIST_EXPIRES_AT_METADATA_KEY]
    delete m[USER_ACTIVITY_DB_SYNCED_METADATA_KEY]
    out.metadata = Object.keys(m).length > 0 ? m : null
  }
  return out
}
