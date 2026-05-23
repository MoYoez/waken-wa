'use client'

import {
  fetchAdminData,
  fetchAdminOk,
  fetchAdminSuccess,
  fetchAdminVoid,
} from '@/lib/admin-client-fetch'
import { tAdminClient } from '@/lib/i18n/admin-client'
import type { AdminUserRow } from '@/types/admin'
import type { AdminSkillsData, SuccessResponse } from '@/types/admin-query'
import type {
  RuleToolsConfigResponse,
  RuleToolsListKey,
  RuleToolsSummary,
} from '@/types/rule-tools'

export async function createAdminUser(input: {
  username: string
  password: string
}): Promise<AdminUserRow> {
  return fetchAdminData<AdminUserRow>('/api/admin/users', {
    method: 'POST',
    json: input,
    fallbackError: tAdminClient('mutation.createAdminUserFailed'),
  })
}

export async function deleteAdminUser(id: number): Promise<void> {
  await fetchAdminVoid(`/api/admin/users/${id}`, {
    method: 'DELETE',
    fallbackError: tAdminClient('mutation.deleteFailed'),
  })
}

export async function changeAdminPassword(input: {
  currentPassword: string
  newPassword: string
}): Promise<void> {
  await fetchAdminVoid('/api/admin/change-password', {
    method: 'POST',
    json: input,
    fallbackError: tAdminClient('mutation.changePasswordFailed'),
  })
}

export async function createAdminDevice(input: {
  displayName: string
  apiTokenId?: number
  generatedHashKey?: string
}): Promise<void> {
  await fetchAdminVoid('/api/admin/devices', {
    method: 'POST',
    json: input,
    fallbackError: tAdminClient('mutation.createDeviceFailed'),
  })
}

export async function patchAdminDevice(body: Record<string, unknown>): Promise<void> {
  await fetchAdminVoid('/api/admin/devices', {
    method: 'PATCH',
    json: body,
    fallbackError: tAdminClient('mutation.updateFailed'),
  })
}

export async function deleteAdminDevice(id: number): Promise<void> {
  await fetchAdminVoid(`/api/admin/devices?id=${id}`, {
    method: 'DELETE',
    fallbackError: tAdminClient('mutation.deleteFailed'),
  })
}

export async function deleteAdminInspirationOrphanAssets(keys: string[]): Promise<{
  deleted: number
  skipped: number
}> {
  const data = await fetchAdminData<{ deleted?: number; skipped?: number }>(
    '/api/admin/inspiration/orphan-assets',
    {
      method: 'DELETE',
      json: { publicKeys: keys },
      fallbackError: tAdminClient('mutation.deleteFailed'),
    },
  )
  return {
    deleted: typeof data.deleted === 'number' ? data.deleted : 0,
    skipped: typeof data.skipped === 'number' ? data.skipped : 0,
  }
}

export async function createAdminToken(input: {
  name: string
  bypassSecondaryReview?: boolean
  bypassSecondaryReviewFirstUseOnly?: boolean
}): Promise<{
  token: string
  tokenBundleBase64: string | null
  endpoint: string | null
}> {
  const { json: data } = await fetchAdminSuccess<
    SuccessResponse<{ token?: string }> & {
      endpoint?: string | null
      tokenBundleBase64?: string | null
    }
  >('/api/admin/tokens', {
    method: 'POST',
    json: input,
    fallbackError: tAdminClient('mutation.createFailed'),
  })
  if (!data.data?.token) throw new Error(tAdminClient('mutation.createFailed'))
  return {
    token: data.data.token,
    tokenBundleBase64: data.tokenBundleBase64 || null,
    endpoint: data.endpoint || null,
  }
}

export async function patchAdminToken(body: Record<string, unknown>): Promise<void> {
  await fetchAdminVoid('/api/admin/tokens', {
    method: 'PATCH',
    json: body,
    fallbackError: tAdminClient('mutation.updateFailed'),
  })
}

export async function deleteAdminToken(id: number): Promise<void> {
  await fetchAdminVoid(`/api/admin/tokens?id=${id}`, {
    method: 'DELETE',
    fallbackError: tAdminClient('mutation.deleteFailed'),
  })
}

export async function patchAdminSkills(body: Record<string, unknown>): Promise<AdminSkillsData> {
  return fetchAdminData<AdminSkillsData>('/api/admin/skills', {
    method: 'PATCH',
    json: body,
    fallbackError: (response) =>
      tAdminClient('mutation.saveFailedHttp', { status: response.status }),
  })
}

export async function createAdminActivity(payload: Record<string, unknown>): Promise<void> {
  await fetchAdminVoid('/api/admin/activity', {
    method: 'POST',
    json: payload,
    fallbackError: tAdminClient('mutation.addFailed'),
  })
}

export async function endAdminActivity(id: number): Promise<void> {
  await fetchAdminVoid('/api/admin/activity', {
    method: 'PATCH',
    json: { id },
    fallbackError: tAdminClient('mutation.endActivityFailed'),
  })
}

export async function uploadInspirationAsset(dataUrl: string): Promise<string> {
  const data = await fetchAdminData<{ url?: string }>('/api/inspiration/assets', {
    method: 'POST',
    json: { imageDataUrl: dataUrl },
    credentials: 'include',
    fallbackError: tAdminClient('mutation.uploadBodyImageFailed'),
  })
  if (!data.url) throw new Error(tAdminClient('mutation.uploadBodyImageFailed'))
  return String(data.url)
}

export async function uploadImageSource(
  imageDataUrl: string,
  usageKey: string,
): Promise<string> {
  const data = await fetchAdminData<{ url?: string }>('/api/image-src', {
    method: 'POST',
    json: { imageDataUrl, usageKey },
    fallbackError: tAdminClient('mutation.uploadBodyImageFailed'),
  })
  if (!data.url) throw new Error(tAdminClient('mutation.uploadBodyImageFailed'))
  return String(data.url)
}

export async function previewThemeRandomImage(apiUrl: string): Promise<string> {
  const data = await fetchAdminData<{ imageUrl?: string }>(
    '/api/admin/settings/theme/random-preview',
    {
      method: 'POST',
      json: { apiUrl },
      fallbackError: tAdminClient('mutation.themeRandomPreviewFailed'),
    },
  )
  const imageUrl = String(data.imageUrl ?? '').trim()
  if (!imageUrl) throw new Error(tAdminClient('mutation.themeRandomPreviewFailed'))
  return imageUrl
}

export async function createInspirationEntry(body: Record<string, unknown>): Promise<void> {
  await fetchAdminVoid('/api/inspiration/entries', {
    method: 'POST',
    json: body,
    fallbackError: tAdminClient('mutation.submitFailed'),
  })
}

export async function patchInspirationEntry(body: Record<string, unknown>): Promise<void> {
  await fetchAdminVoid('/api/inspiration/entries', {
    method: 'PATCH',
    json: body,
    fallbackError: tAdminClient('mutation.saveFailed'),
  })
}

export async function deleteInspirationEntry(id: number): Promise<void> {
  await fetchAdminVoid(`/api/inspiration/entries?id=${id}`, {
    method: 'DELETE',
    fallbackError: tAdminClient('mutation.deleteFailed'),
  })
}

export async function setupAdminSite(input: {
  needAdminSetup: boolean
  username: string
  password: string
  pageTitle: string
  userName: string
  userBio: string
  avatarUrl: string
  avatarFetchByServerEnabled: boolean
  userNote: string
  historyWindowMinutes: number
  currentlyText: string
  earlierText: string
  adminText: string
}): Promise<void> {
  await fetchAdminVoid('/api/admin/setup/admin', {
    method: 'POST',
    json: {
      username: input.needAdminSetup ? input.username : undefined,
      password: input.needAdminSetup ? input.password : undefined,
      pageTitle: input.pageTitle,
      userName: input.userName,
      userBio: input.userBio,
      avatarUrl: input.avatarUrl,
      avatarFetchByServerEnabled: input.avatarFetchByServerEnabled,
      userNote: input.userNote,
      historyWindowMinutes: input.historyWindowMinutes,
      currentlyText: input.currentlyText,
      earlierText: input.earlierText,
      adminText: input.adminText,
    },
    fallbackError: tAdminClient('mutation.setupFailed'),
  })
}

export async function loginAdmin(username: string, password: string): Promise<void> {
  await loginAdminWithCaptcha({ username, password })
}

export async function patchAdminRuleToolsConfig(
  body: Record<string, unknown>,
): Promise<RuleToolsConfigResponse> {
  return fetchAdminData<RuleToolsConfigResponse>('/api/admin/rule-tools/config', {
    method: 'PATCH',
    json: body,
    fallbackError: (response) =>
      tAdminClient('mutation.saveSettingsFailedHttp', { status: response.status }),
  })
}

async function patchAdminSettingsCategory(
  path: string,
  body: Record<string, unknown>,
): Promise<Record<string, any>> {
  return fetchAdminData<Record<string, any>>(path, {
    method: 'PATCH',
    json: body,
    fallbackError: (response) =>
      tAdminClient('mutation.saveSettingsFailedHttp', { status: response.status }),
  })
}

export async function patchAdminSettingsCore(
  body: Record<string, unknown>,
): Promise<Record<string, any>> {
  return patchAdminSettingsCategory('/api/admin/settings/core', body)
}

export async function patchAdminSettingsTheme(
  body: Record<string, unknown>,
): Promise<Record<string, any>> {
  return patchAdminSettingsCategory('/api/admin/settings/theme', body)
}

export async function patchAdminSettingsSchedule(
  body: Record<string, unknown>,
): Promise<Record<string, any>> {
  return patchAdminSettingsCategory('/api/admin/settings/schedule', body)
}

export async function migrateAdminSettings(): Promise<void> {
  await fetchAdminVoid('/api/admin/settings/migration', {
    method: 'POST',
    fallbackError: (response) =>
      tAdminClient('mutation.saveSettingsFailedHttp', { status: response.status }),
  })
}

export async function clearAdminLegacySettingsData(): Promise<void> {
  await fetchAdminVoid('/api/admin/settings/migration/legacy-data', {
    method: 'DELETE',
    fallbackError: (response) =>
      tAdminClient('mutation.saveSettingsFailedHttp', { status: response.status }),
  })
}

export async function patchAdminRuleToolsRules(
  body: Record<string, unknown>,
): Promise<{ revision: string; total: number; groupId?: string; titleRuleId?: string }> {
  return fetchAdminData<{ revision: string; total: number; groupId?: string; titleRuleId?: string }>(
    '/api/admin/rule-tools/rules',
    {
      method: 'PATCH',
      json: body,
      fallbackError: (response) =>
        tAdminClient('mutation.saveSettingsFailedHttp', { status: response.status }),
    },
  )
}

export async function patchAdminRuleToolsList(
  listKey: RuleToolsListKey,
  body: Record<string, unknown>,
): Promise<{ revision: string; total: number }> {
  return fetchAdminData<{ revision: string; total: number }>(
    `/api/admin/rule-tools/lists/${listKey}`,
    {
      method: 'PATCH',
      json: body,
      fallbackError: (response) =>
        tAdminClient('mutation.saveSettingsFailedHttp', { status: response.status }),
    },
  )
}

export async function importAdminRuleTools(
  body: Record<string, unknown>,
): Promise<RuleToolsSummary> {
  return fetchAdminData<RuleToolsSummary>('/api/admin/rule-tools/import', {
    method: 'PATCH',
    json: body,
    fallbackError: (response) =>
      tAdminClient('mutation.saveSettingsFailedHttp', { status: response.status }),
  })
}

export async function loginAdminWithCaptcha(input: {
  username: string
  password: string
  hcaptchaToken?: string
  fallbackErrorMessage?: string
}): Promise<void> {
  await fetchAdminVoid('/api/auth/login', {
    method: 'POST',
    json: {
      username: input.username,
      password: input.password,
      hcaptchaToken: input.hcaptchaToken || undefined,
    },
    fallbackError: input.fallbackErrorMessage || tAdminClient('mutation.autoLoginFailedManual'),
  })
}

export async function logoutAdmin(): Promise<void> {
  await fetchAdminOk('/api/auth/logout', {
    method: 'POST',
    fallbackError: (response) =>
      tAdminClient('mutation.logoutFailedHttp', { status: response.status }),
  })
}

export async function approveSkillsOauthAuthorizeCode(authorizeCode: string): Promise<{
  approved: boolean
  approvedAt: string
  expiresAt: string
}> {
  const data = await fetchAdminData<{
    approved?: boolean
    approvedAt?: string
    expiresAt?: string
  }>('/api/admin/skills/oauth/authorize', {
    method: 'POST',
    json: { confirm: true, authorizeCode },
    fallbackError: (response) => `HTTP ${response.status}`,
  })
  return {
    approved: data.approved === true,
    approvedAt: String(data.approvedAt ?? ''),
    expiresAt: String(data.expiresAt ?? ''),
  }
}
