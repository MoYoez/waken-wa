/**
 * 内存存储活动状态
 * 活动数据临时存储在内存中，不写入数据库
 * 服务器重启后数据会丢失
 */

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

/**
 * 添加或更新活动
 */
export function upsertActivity(data: {
  device: string
  generatedHashKey: string
  deviceId: number
  processName: string
  processTitle: string | null
  metadata: Record<string, unknown> | null
}): ActivityEntry {
  const { generatedHashKey, processName } = data
  const key = `${generatedHashKey}:${processName}`
  
  // 结束该设备上其他进程的活动
  for (const [k, entry] of activityStore.entries()) {
    if (entry.generatedHashKey === generatedHashKey && k !== key && !entry.endedAt) {
      entry.endedAt = new Date()
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
  
  // 创建新活动
  const entry: ActivityEntry = {
    id: generateId(),
    device: data.device,
    generatedHashKey: data.generatedHashKey,
    deviceId: data.deviceId,
    processName: data.processName,
    processTitle: data.processTitle,
    startedAt: now,
    updatedAt: now,
    endedAt: null,
    metadata: data.metadata,
  }
  
  activityStore.set(key, entry)
  return entry
}

/**
 * 获取所有活动（用于 feed）
 */
export function getAllActivities(): ActivityEntry[] {
  return Array.from(activityStore.values())
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
    
    // 检查活动是否过期
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
 * 隐藏设备身份密钥
 */
export function redactGeneratedHashKeyForClient(row: Record<string, unknown>): Record<string, unknown> {
  const { generatedHashKey: _omit, ...rest } = row
  return rest
}
