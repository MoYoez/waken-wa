'use client'

import { type AdminSkillsData, readJson, type SuccessResponse } from '@/components/admin/admin-query-shared'
import { tAdminClient } from '@/lib/i18n/admin-client'
import type { AdminUserRow } from '@/types/admin'
import type { SetupInitialConfig } from '@/types/components'

export async function createAdminUser(input: {
  username: string
  password: string
}): Promise<AdminUserRow> {
  const res = await fetch('/api/admin/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = await readJson<SuccessResponse<AdminUserRow>>(res)
  if (!res.ok || !data?.success || !data.data) {
    throw new Error(
      typeof data?.error === 'string'
        ? data.error
        : tAdminClient('mutation.createAdminUserFailed'),
    )
  }
  return data.data
}

export async function deleteAdminUser(id: number): Promise<void> {
  const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' })
  const data = await readJson<SuccessResponse<unknown>>(res)
  if (!res.ok || !data?.success) {
    throw new Error(
      typeof data?.error === 'string' ? data.error : tAdminClient('mutation.deleteFailed'),
    )
  }
}

export async function changeAdminPassword(input: {
  currentPassword: string
  newPassword: string
}): Promise<void> {
  const res = await fetch('/api/admin/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = await readJson<SuccessResponse<unknown>>(res)
  if (!res.ok || !data?.success) {
    throw new Error(
      typeof data?.error === 'string'
        ? data.error
        : tAdminClient('mutation.changePasswordFailed'),
    )
  }
}

export async function createAdminDevice(input: {
  displayName: string
  apiTokenId?: number
  generatedHashKey?: string
}): Promise<void> {
  const res = await fetch('/api/admin/devices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = await readJson<SuccessResponse<unknown>>(res)
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || tAdminClient('mutation.createDeviceFailed'))
  }
}

export async function patchAdminDevice(body: Record<string, unknown>): Promise<void> {
  const res = await fetch('/api/admin/devices', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await readJson<SuccessResponse<unknown>>(res)
  if (!res.ok || !data?.success) {
    throw new Error(
      typeof data?.error === 'string' ? data.error : tAdminClient('mutation.updateFailed'),
    )
  }
}

export async function deleteAdminDevice(id: number): Promise<void> {
  const res = await fetch(`/api/admin/devices?id=${id}`, { method: 'DELETE' })
  const data = await readJson<SuccessResponse<unknown>>(res)
  if (!res.ok || !data?.success) {
    throw new Error(
      typeof data?.error === 'string' ? data.error : tAdminClient('mutation.deleteFailed'),
    )
  }
}

export async function deleteAdminInspirationOrphanAssets(keys: string[]): Promise<{
  deleted: number
  skipped: number
}> {
  const res = await fetch('/api/admin/inspiration/orphan-assets', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ publicKeys: keys }),
  })
  const data = await readJson<SuccessResponse<{ deleted?: number; skipped?: number }>>(res)
  if (!res.ok || !data?.success) {
    throw new Error(
      typeof data?.error === 'string' ? data.error : tAdminClient('mutation.deleteFailed'),
    )
  }
  return {
    deleted: typeof data.data?.deleted === 'number' ? data.data.deleted : 0,
    skipped: typeof data.data?.skipped === 'number' ? data.data.skipped : 0,
  }
}

export async function createAdminToken(name: string): Promise<{
  token: string
  tokenBundleBase64: string | null
  endpoint: string | null
}> {
  const res = await fetch('/api/admin/tokens', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  const data = await readJson<
    SuccessResponse<{ token?: string }> & {
      tokenBundleBase64?: string | null
      endpoint?: string | null
    }
  >(res)
  if (!res.ok || !data?.success || !data.data?.token) {
    throw new Error(
      typeof data?.error === 'string' ? data.error : tAdminClient('mutation.createFailed'),
    )
  }
  return {
    token: data.data.token,
    tokenBundleBase64: data.tokenBundleBase64 || null,
    endpoint: data.endpoint || null,
  }
}

export async function patchAdminToken(body: Record<string, unknown>): Promise<void> {
  const res = await fetch('/api/admin/tokens', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await readJson<SuccessResponse<unknown>>(res)
  if (!res.ok || !data?.success) {
    throw new Error(
      typeof data?.error === 'string' ? data.error : tAdminClient('mutation.updateFailed'),
    )
  }
}

export async function deleteAdminToken(id: number): Promise<void> {
  const res = await fetch(`/api/admin/tokens?id=${id}`, { method: 'DELETE' })
  const data = await readJson<SuccessResponse<unknown>>(res)
  if (!res.ok || !data?.success) {
    throw new Error(
      typeof data?.error === 'string' ? data.error : tAdminClient('mutation.deleteFailed'),
    )
  }
}

export async function patchAdminSkills(body: Record<string, unknown>): Promise<AdminSkillsData> {
  const res = await fetch('/api/admin/skills', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await readJson<SuccessResponse<AdminSkillsData>>(res)
  if (!data?.success || !data.data) {
    throw new Error(
      data?.error || tAdminClient('mutation.saveFailedHttp', { status: res.status }),
    )
  }
  return data.data
}

export async function patchAdminSettings(
  body: Record<string, unknown>,
): Promise<Record<string, any>> {
  const res = await fetch('/api/admin/settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await readJson<SuccessResponse<Record<string, any>>>(res)
  if (!res.ok || !data?.success || !data.data) {
    throw new Error(
      data?.error || tAdminClient('mutation.saveSettingsFailedHttp', { status: res.status }),
    )
  }
  return data.data
}

export async function createAdminActivity(payload: Record<string, unknown>): Promise<void> {
  const res = await fetch('/api/admin/activity', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await readJson<SuccessResponse<unknown>>(res)
  if (!res.ok || !data?.success) {
    throw new Error(
      typeof data?.error === 'string' ? data.error : tAdminClient('mutation.addFailed'),
    )
  }
}

export async function endAdminActivity(id: number): Promise<void> {
  const res = await fetch('/api/admin/activity', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  })
  const data = await readJson<SuccessResponse<unknown>>(res)
  if (!res.ok || !data?.success) {
    throw new Error(
      typeof data?.error === 'string'
        ? data.error
        : tAdminClient('mutation.endActivityFailed'),
    )
  }
}

export async function uploadInspirationAsset(dataUrl: string): Promise<string> {
  const res = await fetch('/api/inspiration/assets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageDataUrl: dataUrl }),
    credentials: 'include',
  })
  const data = await readJson<SuccessResponse<{ url?: string }>>(res)
  if (!res.ok || !data?.success || !data.data?.url) {
    throw new Error(
      typeof data?.error === 'string'
        ? data.error
        : tAdminClient('mutation.uploadBodyImageFailed'),
    )
  }
  return String(data.data.url)
}

export async function createInspirationEntry(body: Record<string, unknown>): Promise<void> {
  const res = await fetch('/api/inspiration/entries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await readJson<SuccessResponse<unknown>>(res)
  if (!res.ok || !data?.success) {
    throw new Error(
      typeof data?.error === 'string' ? data.error : tAdminClient('mutation.submitFailed'),
    )
  }
}

export async function patchInspirationEntry(body: Record<string, unknown>): Promise<void> {
  const res = await fetch('/api/inspiration/entries', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await readJson<SuccessResponse<unknown>>(res)
  if (!res.ok || !data?.success) {
    throw new Error(
      typeof data?.error === 'string' ? data.error : tAdminClient('mutation.saveFailed'),
    )
  }
}

export async function deleteInspirationEntry(id: number): Promise<void> {
  const res = await fetch(`/api/inspiration/entries?id=${id}`, { method: 'DELETE' })
  const data = await readJson<SuccessResponse<unknown>>(res)
  if (!res.ok || !data?.success) {
    throw new Error(
      typeof data?.error === 'string' ? data.error : tAdminClient('mutation.deleteFailed'),
    )
  }
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
  const res = await fetch('/api/admin/setup/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
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
    }),
  })
  const data = await readJson<SuccessResponse<SetupInitialConfig>>(res)
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || tAdminClient('mutation.setupFailed'))
  }
}

export async function loginAdmin(username: string, password: string): Promise<void> {
  await loginAdminWithCaptcha({ username, password })
}

export async function loginAdminWithCaptcha(input: {
  username: string
  password: string
  hcaptchaToken?: string
  fallbackErrorMessage?: string
}): Promise<void> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: input.username,
      password: input.password,
      hcaptchaToken: input.hcaptchaToken || undefined,
    }),
  })
  const data = await readJson<SuccessResponse<unknown>>(res)
  if (!res.ok || !data?.success) {
    throw new Error(
      data?.error || input.fallbackErrorMessage || tAdminClient('mutation.autoLoginFailedManual'),
    )
  }
}

export async function logoutAdmin(): Promise<void> {
  const res = await fetch('/api/auth/logout', { method: 'POST' })
  if (!res.ok) {
    throw new Error(tAdminClient('mutation.logoutFailedHttp', { status: res.status }))
  }
}

export async function approveSkillsOauthAuthorizeCode(authorizeCode: string): Promise<{
  approved: boolean
  approvedAt: string
  expiresAt: string
}> {
  const res = await fetch('/api/admin/skills/oauth/authorize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirm: true, authorizeCode }),
  })
  const json = await readJson<
    SuccessResponse<{
      approved?: boolean
      approvedAt?: string
      expiresAt?: string
    }>
  >(res)
  if (!json?.success) {
    throw new Error(json?.error || `HTTP ${res.status}`)
  }
  return {
    approved: json.data?.approved === true,
    approvedAt: String(json.data?.approvedAt ?? ''),
    expiresAt: String(json.data?.expiresAt ?? ''),
  }
}
