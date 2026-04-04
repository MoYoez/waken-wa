'use client'

import {
  type AdminSkillsData,
  type DevicesResponse,
  type PaginationResponse,
  readJson,
  type SuccessResponse,
} from '@/components/admin/admin-query-shared'
import type { ActivityFeedData, ActivityFeedItem } from '@/types/activity'
import type {
  AdminDeviceItem,
  AdminDeviceSummary,
  AdminTokenOption,
  AdminUserRow,
  ApiTokenListRow,
} from '@/types/admin'
import type { AdminInspirationEntry } from '@/types/inspiration'
import type { OrphanAssetRow } from '@/types/inspiration'

export async function fetchAdminUsers(): Promise<AdminUserRow[]> {
  const res = await fetch('/api/admin/users')
  const data = await readJson<SuccessResponse<AdminUserRow[]>>(res)
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || `加载管理员失败（HTTP ${res.status}）`)
  }
  return Array.isArray(data.data) ? data.data : []
}

export async function fetchAdminDeviceSummaries(input?: {
  limit?: number
  status?: string
}): Promise<AdminDeviceSummary[]> {
  const params = new URLSearchParams()
  if (typeof input?.limit === 'number') params.set('limit', String(input.limit))
  if (input?.status) params.set('status', input.status)

  const query = params.toString()
  const res = await fetch(query ? `/api/admin/devices?${query}` : '/api/admin/devices')
  const data = await readJson<DevicesResponse>(res)
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || `加载设备列表失败（HTTP ${res.status}）`)
  }

  return Array.isArray(data.data)
    ? data.data.map((row) => ({
        id: Number(row.id),
        displayName: String(row.displayName ?? ''),
        generatedHashKey: String(row.generatedHashKey ?? ''),
        status: String(row.status ?? 'active'),
      }))
    : []
}

export async function fetchAdminDevicesPage(input: {
  page: number
  q: string
  status: string
  pageSize: number
}): Promise<{ items: AdminDeviceItem[]; total: number }> {
  const params = new URLSearchParams({
    limit: String(input.pageSize),
    offset: String(input.page * input.pageSize),
  })
  if (input.q.trim()) params.set('q', input.q.trim())
  if (input.status) params.set('status', input.status)

  const res = await fetch(`/api/admin/devices?${params}`)
  const data = await readJson<
    SuccessResponse<AdminDeviceItem[]> & { pagination?: PaginationResponse }
  >(res)
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || `加载设备失败（HTTP ${res.status}）`)
  }
  return {
    items: Array.isArray(data.data) ? data.data : [],
    total: Number(data.pagination?.total || 0),
  }
}

export async function fetchAdminInspirationOrphanAssets(): Promise<OrphanAssetRow[]> {
  const res = await fetch('/api/admin/inspiration/orphan-assets')
  const data = await readJson<SuccessResponse<OrphanAssetRow[]>>(res)
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || `读取孤儿图片失败（HTTP ${res.status}）`)
  }
  return Array.isArray(data.data) ? data.data : []
}

export async function fetchAdminTokenOptions(): Promise<AdminTokenOption[]> {
  const res = await fetch('/api/admin/tokens')
  const data = await readJson<SuccessResponse<AdminTokenOption[]>>(res)
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || `加载 Token 失败（HTTP ${res.status}）`)
  }
  return Array.isArray(data.data) ? data.data : []
}

export async function fetchAdminTokenPage(input: {
  page: number
  pageSize: number
}): Promise<{ rows: ApiTokenListRow[]; total: number }> {
  const params = new URLSearchParams({
    limit: String(input.pageSize),
    offset: String(input.page * input.pageSize),
  })
  const res = await fetch(`/api/admin/tokens?${params}`)
  const data = await readJson<
    SuccessResponse<ApiTokenListRow[]> & { pagination?: PaginationResponse }
  >(res)
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || `加载 Token 失败（HTTP ${res.status}）`)
  }
  const rows = Array.isArray(data.data) ? data.data : []
  return {
    rows,
    total: typeof data.pagination?.total === 'number' ? data.pagination.total : rows.length,
  }
}

export async function fetchAdminSettings(): Promise<Record<string, any>> {
  const res = await fetch('/api/admin/settings')
  const data = await readJson<SuccessResponse<Record<string, any>>>(res)
  if (!res.ok || !data?.success || !data.data) {
    throw new Error(data?.error || `加载站点配置失败（HTTP ${res.status}）`)
  }
  return data.data
}

export async function fetchAdminSkills(): Promise<AdminSkillsData> {
  const res = await fetch('/api/admin/skills')
  const data = await readJson<SuccessResponse<AdminSkillsData>>(res)
  if (!res.ok || !data?.success || !data.data) {
    throw new Error(data?.error || `加载 Skills 配置失败（HTTP ${res.status}）`)
  }
  return data.data
}

export async function exportAdminSettings(): Promise<string> {
  const res = await fetch('/api/admin/settings/export')
  const data = await readJson<SuccessResponse<{ encoded?: string }>>(res)
  if (!res.ok || !data?.success || !data.data?.encoded) {
    throw new Error(typeof data?.error === 'string' ? data.error : '导出失败')
  }
  return data.data.encoded
}

export async function fetchActivityFeed(): Promise<ActivityFeedData> {
  const res = await fetch('/api/activity', { cache: 'no-store' })
  const data = await readJson<SuccessResponse<ActivityFeedData>>(res)
  if (!res.ok || !data?.success || !data.data) {
    throw new Error(data?.error || `读取活动流失败（HTTP ${res.status}）`)
  }
  return data.data
}

export async function fetchPublicActivityFeed(): Promise<ActivityFeedData> {
  const res = await fetch('/api/activity?public=1')
  const data = await readJson<SuccessResponse<ActivityFeedData>>(res)
  if (!res.ok || !data?.success || !data.data) {
    throw new Error(data?.error || `活动数据加载失败（HTTP ${res.status}）`)
  }
  return data.data
}

export async function fetchRecentActivityUsage(
  limit?: number,
): Promise<ActivityFeedItem[]> {
  const data = await fetchActivityFeed()
  const recentActivities = Array.isArray(data.recentActivities) ? data.recentActivities : []
  return typeof limit === 'number' ? recentActivities.slice(0, limit) : recentActivities
}

export async function fetchActivityHistoryApps(input?: {
  limit?: number
}): Promise<string[]> {
  const params = new URLSearchParams()
  if (typeof input?.limit === 'number') params.set('limit', String(input.limit))
  const query = params.toString()
  const res = await fetch(
    query ? `/api/admin/activity/history/apps?${query}` : '/api/admin/activity/history/apps',
  )
  const data = await readJson<SuccessResponse<Array<{ processName?: unknown }>>>(res)
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || `加载历史应用失败（HTTP ${res.status}）`)
  }
  return Array.isArray(data.data)
    ? data.data
        .map((item) => String(item?.processName ?? '').trim())
        .filter((item) => item.length > 0)
    : []
}

export async function fetchActivityHistoryPlaySources(input?: {
  limit?: number
}): Promise<string[]> {
  const params = new URLSearchParams()
  if (typeof input?.limit === 'number') params.set('limit', String(input.limit))
  const query = params.toString()
  const res = await fetch(
    query
      ? `/api/admin/activity/history/play-sources?${query}`
      : '/api/admin/activity/history/play-sources',
  )
  const data = await readJson<SuccessResponse<Array<{ playSource?: unknown }>>>(res)
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || `加载历史媒体来源失败（HTTP ${res.status}）`)
  }
  return Array.isArray(data.data)
    ? data.data
        .map((item) => String(item?.playSource ?? '').trim().toLowerCase())
        .filter((item) => item.length > 0)
    : []
}

export async function exportAdminActivityApps(): Promise<unknown> {
  const res = await fetch('/api/admin/activity/apps-export')
  const data = await readJson<SuccessResponse<unknown>>(res)
  if (!res.ok || !data?.success || typeof data.data === 'undefined') {
    throw new Error(typeof data?.error === 'string' ? data.error : '导出失败')
  }
  return data.data
}

export async function fetchAdminInspirationEntries(input: {
  page: number
  q: string
  pageSize: number
}): Promise<{
  entries: AdminInspirationEntry[]
  total: number
  displayTimezone: string
}> {
  const params = new URLSearchParams({
    limit: String(input.pageSize),
    offset: String(input.page * input.pageSize),
  })
  if (input.q.trim()) params.set('q', input.q.trim())
  const res = await fetch(`/api/inspiration/entries?${params}`)
  const data = await readJson<
    SuccessResponse<AdminInspirationEntry[]> & {
      pagination?: { total?: number }
      displayTimezone?: string
    }
  >(res)
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || `加载灵感记录失败（HTTP ${res.status}）`)
  }
  return {
    entries: Array.isArray(data.data) ? data.data : [],
    total: Number(data.pagination?.total || 0),
    displayTimezone: typeof data.displayTimezone === 'string' ? data.displayTimezone : 'Asia/Shanghai',
  }
}
