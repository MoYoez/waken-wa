'use client'

import { type AdminSkillsData, readJson, type SuccessResponse } from '@/components/admin/admin-query-shared'
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
    throw new Error(typeof data?.error === 'string' ? data.error : '创建管理员失败')
  }
  return data.data
}

export async function deleteAdminUser(id: number): Promise<void> {
  const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' })
  const data = await readJson<SuccessResponse<unknown>>(res)
  if (!res.ok || !data?.success) {
    throw new Error(typeof data?.error === 'string' ? data.error : '删除失败')
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
    throw new Error(typeof data?.error === 'string' ? data.error : '密码修改失败')
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
    throw new Error(data?.error || '创建设备失败')
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
    throw new Error(typeof data?.error === 'string' ? data.error : '更新失败')
  }
}

export async function deleteAdminDevice(id: number): Promise<void> {
  const res = await fetch(`/api/admin/devices?id=${id}`, { method: 'DELETE' })
  const data = await readJson<SuccessResponse<unknown>>(res)
  if (!res.ok || !data?.success) {
    throw new Error(typeof data?.error === 'string' ? data.error : '删除失败')
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
    throw new Error(typeof data?.error === 'string' ? data.error : '删除失败')
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
    throw new Error(typeof data?.error === 'string' ? data.error : '创建失败')
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
    throw new Error(typeof data?.error === 'string' ? data.error : '更新失败')
  }
}

export async function deleteAdminToken(id: number): Promise<void> {
  const res = await fetch(`/api/admin/tokens?id=${id}`, { method: 'DELETE' })
  const data = await readJson<SuccessResponse<unknown>>(res)
  if (!res.ok || !data?.success) {
    throw new Error(typeof data?.error === 'string' ? data.error : '删除失败')
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
    throw new Error(data?.error || `保存失败（HTTP ${res.status}）`)
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
    throw new Error(data?.error || `保存站点配置失败（HTTP ${res.status}）`)
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
    throw new Error(typeof data?.error === 'string' ? data.error : '添加失败')
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
    throw new Error(typeof data?.error === 'string' ? data.error : '正文配图上传失败')
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
    throw new Error(typeof data?.error === 'string' ? data.error : '提交失败')
  }
}

export async function deleteInspirationEntry(id: number): Promise<void> {
  const res = await fetch(`/api/inspiration/entries?id=${id}`, { method: 'DELETE' })
  const data = await readJson<SuccessResponse<unknown>>(res)
  if (!res.ok || !data?.success) {
    throw new Error(typeof data?.error === 'string' ? data.error : '删除失败')
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
      userNote: input.userNote,
      historyWindowMinutes: input.historyWindowMinutes,
      currentlyText: input.currentlyText,
      earlierText: input.earlierText,
      adminText: input.adminText,
    }),
  })
  const data = await readJson<SuccessResponse<SetupInitialConfig>>(res)
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || '初始化失败')
  }
}

export async function loginAdmin(username: string, password: string): Promise<void> {
  await loginAdminWithCaptcha({ username, password })
}

export async function loginAdminWithCaptcha(input: {
  username: string
  password: string
  hcaptchaToken?: string
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
    throw new Error(data?.error || '自动登录失败，请手动登录')
  }
}

export async function logoutAdmin(): Promise<void> {
  const res = await fetch('/api/auth/logout', { method: 'POST' })
  if (!res.ok) {
    throw new Error(`登出失败（HTTP ${res.status}）`)
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
