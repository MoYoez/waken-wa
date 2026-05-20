'use client'

import { fetchAdminData, fetchAdminSuccess } from '@/lib/admin-client-fetch'
import { tAdminClient } from '@/lib/i18n/admin-client'
import type { ActivityFeedData } from '@/types/activity'
import type {
  AdminDeviceItem,
  AdminDeviceSummary,
  AdminTokenOption,
  AdminUserRow,
  ApiTokenListRow,
} from '@/types/admin'
import type { AdminSkillsData, PaginationResponse, SuccessResponse } from '@/types/admin-query'
import type { AdminInspirationEntry } from '@/types/inspiration'
import type { OrphanAssetRow } from '@/types/inspiration'
import type {
  RuleToolsConfigResponse,
  RuleToolsExportPayload,
  RuleToolsListKey,
  RuleToolsListResponse,
  RuleToolsRulesResponse,
  RuleToolsSummary,
} from '@/types/rule-tools'
import type { SiteSettingsMigrationInfo } from '@/types/web-settings'

export async function fetchAdminUsers(): Promise<AdminUserRow[]> {
  const data = await fetchAdminData<AdminUserRow[]>('/api/admin/users', {
    fallbackError: (response) =>
      tAdminClient('query.loadAdminsFailed', { status: response.status }),
  })
  return Array.isArray(data) ? data : []
}

export async function fetchAdminDeviceSummaries(input?: {
  limit?: number
  status?: string
}): Promise<AdminDeviceSummary[]> {
  const params = new URLSearchParams()
  if (typeof input?.limit === 'number') params.set('limit', String(input.limit))
  if (input?.status) params.set('status', input.status)

  const query = params.toString()
  const data = await fetchAdminData<Array<Record<string, unknown>>>(
    query ? `/api/admin/devices?${query}` : '/api/admin/devices',
    {
      fallbackError: (response) =>
        tAdminClient('query.loadDeviceListFailed', { status: response.status }),
    },
  )

  return Array.isArray(data)
    ? data.map((row) => ({
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

  const { json: data } = await fetchAdminSuccess<
    SuccessResponse<AdminDeviceItem[]> & { pagination?: PaginationResponse }
  >(`/api/admin/devices?${params}`, {
    fallbackError: (response) =>
      tAdminClient('query.loadDevicesFailed', { status: response.status }),
  })
  return {
    items: Array.isArray(data.data) ? data.data : [],
    total: Number(data.pagination?.total || 0),
  }
}

export async function fetchAdminInspirationOrphanAssets(): Promise<OrphanAssetRow[]> {
  const data = await fetchAdminData<OrphanAssetRow[]>('/api/admin/inspiration/orphan-assets', {
    fallbackError: (response) =>
      tAdminClient('query.loadOrphanImagesFailed', { status: response.status }),
  })
  return Array.isArray(data) ? data : []
}

export async function fetchAdminTokenOptions(): Promise<AdminTokenOption[]> {
  const data = await fetchAdminData<AdminTokenOption[]>('/api/admin/tokens', {
    fallbackError: (response) =>
      tAdminClient('query.loadTokensFailed', { status: response.status }),
  })
  return Array.isArray(data) ? data : []
}

export async function fetchAdminTokenPage(input: {
  page: number
  pageSize: number
}): Promise<{ rows: ApiTokenListRow[]; total: number }> {
  const params = new URLSearchParams({
    limit: String(input.pageSize),
    offset: String(input.page * input.pageSize),
  })
  const { json: data } = await fetchAdminSuccess<
    SuccessResponse<ApiTokenListRow[]> & { pagination?: PaginationResponse }
  >(`/api/admin/tokens?${params}`, {
    fallbackError: (response) =>
      tAdminClient('query.loadTokensFailed', { status: response.status }),
  })
  const rows = Array.isArray(data.data) ? data.data : []
  return {
    rows,
    total: typeof data.pagination?.total === 'number' ? data.pagination.total : rows.length,
  }
}

export async function fetchAdminSettings(): Promise<Record<string, any>> {
  const paths = [
    '/api/admin/settings/core',
    '/api/admin/settings/theme',
    '/api/admin/settings/schedule',
  ] as const

  const segments = await Promise.all(
    paths.map((path) =>
      fetchAdminData<Record<string, any>>(path, {
        fallbackError: (response) =>
          tAdminClient('query.loadSettingsFailed', { status: response.status }),
      }),
    ),
  )

  if (segments.length === 0) {
    throw new Error(tAdminClient('query.loadSettingsFailed', { status: 'unknown' }))
  }

  return Object.assign({}, ...segments)
}

export async function fetchAdminSkills(): Promise<AdminSkillsData> {
  return fetchAdminData<AdminSkillsData>('/api/admin/skills', {
    fallbackError: (response) =>
      tAdminClient('query.loadSkillsFailed', { status: response.status }),
  })
}

export async function exportAdminSettings(): Promise<string> {
  const data = await fetchAdminData<{ encoded?: string }>('/api/admin/settings/export', {
    fallbackError: tAdminClient('query.exportFailed'),
  })
  if (!data.encoded) throw new Error(tAdminClient('query.exportFailed'))
  return data.encoded
}

export async function fetchActivityFeed(): Promise<ActivityFeedData> {
  return fetchAdminData<ActivityFeedData>('/api/activity', {
    cache: 'no-store',
    fallbackError: (response) =>
      tAdminClient('query.loadActivityFeedFailed', { status: response.status }),
  })
}

export async function fetchPublicActivityFeed(): Promise<ActivityFeedData> {
  return fetchAdminData<ActivityFeedData>('/api/activity?public=1', {
    fallbackError: (response) =>
      tAdminClient('query.loadPublicActivityFeedFailed', { status: response.status }),
  })
}

export async function fetchAdminSettingsMigration(): Promise<SiteSettingsMigrationInfo> {
  return fetchAdminData<SiteSettingsMigrationInfo>('/api/admin/settings/migration', {
    fallbackError: (response) =>
      tAdminClient('query.loadSettingsFailed', { status: response.status }),
  })
}

export async function fetchActivityHistoryApps(input?: {
  limit?: number
  q?: string
  offset?: number
}): Promise<string[]> {
  const params = new URLSearchParams()
  if (typeof input?.limit === 'number') params.set('limit', String(input.limit))
  if (typeof input?.offset === 'number') params.set('offset', String(input.offset))
  if (input?.q?.trim()) params.set('q', input.q.trim())
  const query = params.toString()
  const data = await fetchAdminData<Array<{ processName?: unknown }>>(
    query ? `/api/admin/activity/history/apps?${query}` : '/api/admin/activity/history/apps',
    {
      fallbackError: (response) =>
        tAdminClient('query.loadHistoryAppsFailed', { status: response.status }),
    },
  )
  return Array.isArray(data)
    ? data
        .map((item) => String(item?.processName ?? '').trim())
        .filter((item) => item.length > 0)
    : []
}

export async function fetchActivityHistoryPlaySources(input?: {
  limit?: number
  q?: string
  offset?: number
}): Promise<string[]> {
  const params = new URLSearchParams()
  if (typeof input?.limit === 'number') params.set('limit', String(input.limit))
  if (typeof input?.offset === 'number') params.set('offset', String(input.offset))
  if (input?.q?.trim()) params.set('q', input.q.trim())
  const query = params.toString()
  const data = await fetchAdminData<Array<{ playSource?: unknown }>>(
    query
      ? `/api/admin/activity/history/play-sources?${query}`
      : '/api/admin/activity/history/play-sources',
    {
      fallbackError: (response) =>
        tAdminClient('query.loadHistoryPlaySourcesFailed', { status: response.status }),
    },
  )
  return Array.isArray(data)
    ? data
        .map((item) => String(item?.playSource ?? '').trim().toLowerCase())
        .filter((item) => item.length > 0)
    : []
}

export async function exportAdminActivityApps(): Promise<unknown> {
  return fetchAdminData<unknown>('/api/admin/activity/apps-export', {
    fallbackError: tAdminClient('query.exportFailed'),
  })
}

export async function fetchAdminRuleToolsSummary(): Promise<RuleToolsSummary> {
  return fetchAdminData<RuleToolsSummary>('/api/admin/rule-tools/summary', {
    fallbackError: (response) =>
      tAdminClient('query.loadSettingsFailed', { status: response.status }),
  })
}

export async function fetchAdminRuleToolsConfig(): Promise<RuleToolsConfigResponse> {
  return fetchAdminData<RuleToolsConfigResponse>('/api/admin/rule-tools/config', {
    fallbackError: (response) =>
      tAdminClient('query.loadSettingsFailed', { status: response.status }),
  })
}

export async function fetchAdminRuleToolsRulesPage(input: {
  page: number
  q: string
  pageSize: number
}): Promise<RuleToolsRulesResponse> {
  const params = new URLSearchParams({
    limit: String(input.pageSize),
    offset: String(input.page * input.pageSize),
  })
  if (input.q.trim()) params.set('q', input.q.trim())
  return fetchAdminData<RuleToolsRulesResponse>(`/api/admin/rule-tools/rules?${params}`, {
    fallbackError: (response) =>
      tAdminClient('query.loadSettingsFailed', { status: response.status }),
  })
}

export async function fetchAdminRuleToolsListPage(input: {
  listKey: RuleToolsListKey
  page: number
  q: string
  pageSize: number
}): Promise<RuleToolsListResponse> {
  const params = new URLSearchParams({
    limit: String(input.pageSize),
    offset: String(input.page * input.pageSize),
  })
  if (input.q.trim()) params.set('q', input.q.trim())
  return fetchAdminData<RuleToolsListResponse>(
    `/api/admin/rule-tools/lists/${input.listKey}?${params}`,
    {
      fallbackError: (response) =>
        tAdminClient('query.loadSettingsFailed', { status: response.status }),
    },
  )
}

export async function exportAdminRuleTools(): Promise<RuleToolsExportPayload> {
  return fetchAdminData<RuleToolsExportPayload>('/api/admin/rule-tools/export', {
    fallbackError: tAdminClient('query.exportFailed'),
  })
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
  const { json: data } = await fetchAdminSuccess<
    SuccessResponse<AdminInspirationEntry[]> & {
      pagination?: { total?: number }
      displayTimezone?: string
    }
  >(`/api/inspiration/entries?${params}`, {
    fallbackError: (response) =>
      tAdminClient('query.loadInspirationEntriesFailed', { status: response.status }),
  })
  return {
    entries: Array.isArray(data.data) ? data.data : [],
    total: Number(data.pagination?.total || 0),
    displayTimezone:
      typeof data.displayTimezone === 'string' ? data.displayTimezone : 'Asia/Shanghai',
  }
}
