/** Admin users list from GET /api/admin/users (JSON). */
export interface AdminUserRow {
  id: number
  username: string
  createdAt: string
}

export interface RecentDeviceRow {
  displayName: string
  generatedHashKey: string
  lastSeenAt: string | null
}

/** API tokens list row (serialized dates). */
export interface ApiTokenListRow {
  id: number
  name: string
  token: string
  isActive: boolean
  createdAt: string
  lastUsedAt: string | null
  recentDevices?: RecentDeviceRow[]
}
