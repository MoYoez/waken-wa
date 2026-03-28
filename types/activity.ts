/** Client POST body for /api/activity (device report). */
export interface ActivityInput {
  generatedHashKey: string
  device: string
  device_type?: 'desktop' | 'tablet' | 'mobile'
  process_name: string
  process_title?: string
  battery_level?: number
  push_mode?: 'realtime' | 'active'
  metadata?: Record<string, unknown>
}

export interface PaginatedResponse<T> {
  success: boolean
  data: T[]
  pagination: {
    limit: number
    offset: number
    total: number
  }
}

/** In-memory activity row (server store). */
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

/** Serialized row in public feed / SSE payloads. */
export interface ActivityFeedItem {
  id: number | string
  deviceId?: number | null
  device: string
  processName: string
  processTitle: string | null
  startedAt: string
  endedAt: string | null
  metadata?: Record<string, unknown> | null
  statusText?: string
  pushMode?: 'realtime' | 'active'
  lastReportAt?: string
  updatedAt?: string
  steamNowPlaying?: { appId: string; name: string; imageUrl: string } | null
}

export interface ActivityFeedData {
  activeStatuses: ActivityFeedItem[]
  recentActivities: ActivityFeedItem[]
  historyWindowMinutes: number
  processStaleSeconds: number
  recentTopApps: ActivityFeedItem[]
  generatedAt: string
}

export interface UpsertActivityPayload {
  device: string
  generatedHashKey: string
  deviceId: number
  processName: string
  processTitle: string | null
  metadata: Record<string, unknown> | null
}

export type UpsertActivityOptions = {
  startedAtOverride?: Date
  skipEndOtherProcessesOnDevice?: boolean
}
