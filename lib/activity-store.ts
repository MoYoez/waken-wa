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

const activityStore = new Map<string, ActivityEntry>()

let idCounter = 0
function generateId(): string {
  return `activity_${Date.now()}_${++idCounter}`
}

export function upsertActivity(
  data: UpsertActivityPayload,
  options?: UpsertActivityOptions,
): ActivityEntry {
  const { generatedHashKey, processName } = data
  const key = `${generatedHashKey}:${processName}`

  if (!options?.skipEndOtherProcessesOnDevice) {
    for (const [k, entry] of activityStore.entries()) {
      if (entry.generatedHashKey === generatedHashKey && k !== key && !entry.endedAt) {
        entry.endedAt = new Date()
      }
    }
  }

  const existing = activityStore.get(key)
  const now = new Date()

  if (existing && !existing.endedAt) {
    existing.updatedAt = now
    if (data.processTitle) {
      existing.processTitle = data.processTitle
    }
    if (data.metadata) {
      existing.metadata = {
        ...(existing.metadata || {}),
        ...data.metadata,
      }
    }
    return existing
  }

  const startedAt = options?.startedAtOverride ?? now

  const entry: ActivityEntry = {
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

  activityStore.set(key, entry)
  return entry
}

export function removeActivityStoreEntry(generatedHashKey: string, processName: string): void {
  activityStore.delete(`${generatedHashKey}:${processName}`)
}

export function getAllActivities(): ActivityEntry[] {
  return Array.from(activityStore.values())
}

function getAdminPersistSeconds(metadata: unknown): number | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  const raw = (metadata as Record<string, unknown>)[ADMIN_PERSIST_SECONDS_METADATA_KEY]
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) return null
  return raw
}

function getUserPersistExpiresAtMs(metadata: unknown): number | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  const raw = (metadata as Record<string, unknown>)[USER_PERSIST_EXPIRES_AT_METADATA_KEY]
  if (typeof raw !== 'string') return null
  const t = Date.parse(raw)
  if (!Number.isFinite(t)) return null
  return t
}

export function cleanupStaleActivities(staleSeconds: number): void {
  const now = Date.now()

  for (const [key, entry] of activityStore.entries()) {
    if (entry.endedAt) {
      if (now - entry.endedAt.getTime() > staleSeconds * 1000) {
        activityStore.delete(key)
      }
      continue
    }

    const adminPersist = getAdminPersistSeconds(entry.metadata)
    if (adminPersist != null) {
      const lastReportTime = entry.updatedAt.getTime()
      if (now - lastReportTime > adminPersist * 1000) {
        entry.endedAt = new Date()
      }
      continue
    }

    const userExpireAt = getUserPersistExpiresAtMs(entry.metadata)
    if (userExpireAt != null && now >= userExpireAt) {
      entry.endedAt = new Date()
      continue
    }

    const pushMode = getPushModeFromMetadata(entry.metadata)
    if (pushMode === 'active') continue

    const lastReportTime = entry.updatedAt.getTime()
    if (now - lastReportTime > staleSeconds * 1000) {
      entry.endedAt = new Date()
    }
  }
}

function getPushModeFromMetadata(metadata: unknown): 'realtime' | 'active' {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return 'realtime'
  const meta = metadata as Record<string, unknown>
  const mode = String(meta.pushMode ?? '').trim().toLowerCase()
  if (mode === 'active' || mode === 'persistent') return 'active'
  return 'realtime'
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
