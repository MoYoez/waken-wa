/**
 * 内存存储活动状态
 * 活动数据临时存储在内存中，不写入数据库
 * 服务器重启后数据会丢失
 */

/** Admin quick-add: silence timeout in seconds (not exposed to clients; stripped in redact). */
export const ADMIN_PERSIST_SECONDS_METADATA_KEY = 'adminPersistSeconds' as const

/** Client DB-backed persist: absolute expiry ISO string (not exposed to clients; stripped in redact). */
export const USER_PERSIST_EXPIRES_AT_METADATA_KEY = 'userPersistExpiresAt' as const

/** Set when a row exists in UserActivity for this session (internal; stripped in redact). */
export const USER_ACTIVITY_DB_SYNCED_METADATA_KEY = 'userActivityDbSynced' as const

export interface ActivityEntry {
  id: string
  device: string
  generatedHashKey: string
  deviceId: number
  processName: string
  processTitle: string | null
  startedAt: Date
  updatedAt: Date
  endedAt: Date | null
  metadata: Record<string, unknown> | null
}

export interface ActivityFeedData {
  activeStatuses: any[]
  recentActivities: any[]
  historyWindowMinutes: number
  processStaleSeconds: number
  recentTopApps: any[]
  generatedAt: string
}

// 内存存储
const activityStore = new Map<string, ActivityEntry>()

// 生成唯一 ID
let idCounter = 0
function generateId(): string {
  return `activity_${Date.now()}_${++idCounter}`
}

export type UpsertActivityOptions = {
  /** When hydrating from DB, preserve original startedAt */
  startedAtOverride?: Date
  /** Hydration loads many rows; do not end sibling processes per row */
  skipEndOtherProcessesOnDevice?: boolean
}

/**
 * 添加或更新活动
 */
export function upsertActivity(
  data: {
    device: string
    generatedHashKey: string
    deviceId: number
    processName: string
    processTitle: string | null
    metadata: Record<string, unknown> | null
  },
  options?: UpsertActivityOptions,
): ActivityEntry {
  const { generatedHashKey, processName } = data
  const key = `${generatedHashKey}:${processName}`

  if (!options?.skipEndOtherProcessesOnDevice) {
    // 结束该设备上其他进程的活动
    for (const [k, entry] of activityStore.entries()) {
      if (entry.generatedHashKey === generatedHashKey && k !== key && !entry.endedAt) {
        entry.endedAt = new Date()
      }
    }
  }

  const existing = activityStore.get(key)
  const now = new Date()

  if (existing && !existing.endedAt) {
    // 更新现有活动
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

  // 创建新活动
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

/**
 * Remove one activity slot from memory (e.g. after DB purge).
 */
export function removeActivityStoreEntry(generatedHashKey: string, processName: string): void {
  activityStore.delete(`${generatedHashKey}:${processName}`)
}

/**
 * 获取所有活动（用于 feed）
 */
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

/**
 * 清理过期活动
 */
export function cleanupStaleActivities(staleSeconds: number): void {
  const now = Date.now()

  for (const [key, entry] of activityStore.entries()) {
    if (entry.endedAt) {
      // 已结束的活动，保留一段时间后删除
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
    if (pushMode === 'active') continue // active 模式不过期

    const lastReportTime = entry.updatedAt.getTime()
    if (now - lastReportTime > staleSeconds * 1000) {
      entry.endedAt = new Date()
    }
  }
}

/**
 * 从 metadata 获取 pushMode
 */
function getPushModeFromMetadata(metadata: unknown): 'realtime' | 'active' {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return 'realtime'
  const meta = metadata as Record<string, unknown>
  const mode = String(meta.pushMode ?? '').trim().toLowerCase()
  if (mode === 'active' || mode === 'persistent') return 'active'
  return 'realtime'
}

/**
 * 隐藏设备身份密钥与内部 metadata 字段
 */
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
