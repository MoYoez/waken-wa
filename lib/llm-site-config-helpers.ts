import { normalizeAdminThemeColor } from '@/lib/admin-theme-color'
import { mergeRedisCacheAdminFields } from '@/lib/cache-runtime-toggle'
import { normalizeProfileOnlineAccentColor } from '@/lib/profile-online-accent-color'
import { getSiteConfigMemoryFirst } from '@/lib/site-config-cache'
import { normalizeSiteConfigShape } from '@/lib/site-config-normalize'
import { sanitizeSiteConfigImagesForClient } from '@/lib/site-image-urls'
import {
  normalizeTodayStatusBusy,
  normalizeTodayStatusEmoji,
  normalizeTodayStatusExpiresAt,
  normalizeTodayStatusText,
} from '@/lib/today-status'

export type SiteConfigClientMode = 'public' | 'admin' | 'masked'

export const LLM_DENIED_SITE_CONFIG_KEYS = [
  'adminThemeColor',
  'adminBackgroundColor',
  'userNoteTypewriterEnabled',
  'pageLoadingEnabled',
  'searchEngineIndexingEnabled',
  'openApiDocsEnabled',
  'useNoSqlAsCacheRedis',
  'redisCacheTtlSeconds',
  'activityUpdateMode',
  'processStaleSeconds',
  'historyWindowMinutes',
  'steamApiKey',
  'autoAcceptNewDevices',
  'inspirationAllowedDeviceHashes',
  'pageLockEnabled',
  'pageLockPassword',
  'hcaptchaEnabled',
  'hcaptchaSiteKey',
  'hcaptchaSecretKey',
  'skillsDebugEnabled',
  'skillsAuthMode',
  'skillsOauthTokenTtlMinutes',
] as const

export type SiteConfigRecord = Record<string, any>

export function ensureJsonObject(body: Record<string, unknown>) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    const error = new Error('Request body must be a JSON object.')
    ;(error as any).status = 400
    throw error
  }
}

export function assertAllowedLlmFields(
  body: Record<string, unknown>,
  options?: { allowRestrictedFields?: boolean },
) {
  if (options?.allowRestrictedFields) return

  const denied = new Set<string>(LLM_DENIED_SITE_CONFIG_KEYS)
  const presentDeniedKeys = Object.keys(body ?? {}).filter((key) => denied.has(key))
  if (presentDeniedKeys.length > 0) {
    const error = new Error(`This request includes fields that AI Skills cannot modify: ${presentDeniedKeys.join(', ')}`)
    ;(error as any).status = 403
    ;(error as any).deniedKeys = presentDeniedKeys
    throw error
  }
}

export function normalizeAiToolMode(raw: unknown): 'skills' | 'mcp' {
  return String(raw ?? '').trim().toLowerCase() === 'mcp' ? 'mcp' : 'skills'
}

export function redactSiteConfigForClient(
  config: SiteConfigRecord,
  mode: SiteConfigClientMode = 'public',
) {
  const normalized = normalizeSiteConfigShape(config) as SiteConfigRecord
  const redisAdmin = mergeRedisCacheAdminFields(normalized)
  const redacted = {
    ...normalized,
    pageLockPasswordHash: undefined,
    hcaptchaSecretKey: normalized.hcaptchaSecretKey ? '••••••••' : null,
    steamApiKey: normalized.steamApiKey ? '••••••••' : null,
    useNoSqlAsCacheRedis: redisAdmin.useNoSqlAsCacheRedis,
    redisCacheServerlessForced: redisAdmin.redisCacheServerlessForced,
  }
  if (mode === 'masked') {
    return redacted
  }
  return sanitizeSiteConfigImagesForClient(redacted, mode)
}

export async function getSafeSiteConfig(mode: SiteConfigClientMode = 'public') {
  const config = await getSiteConfigMemoryFirst()
  if (!config) return null
  return redactSiteConfigForClient(config as SiteConfigRecord, mode)
}

export async function getNormalizedExistingSiteConfig(): Promise<SiteConfigRecord | null> {
  const existingRaw = await getSiteConfigMemoryFirst()
  return existingRaw ? normalizeSiteConfigShape(existingRaw as SiteConfigRecord) : null
}

export function createSiteConfigFieldReaders(
  body: Record<string, unknown>,
  existing: SiteConfigRecord | null,
) {
  const getExisting = (key: string) => (existing as Record<string, unknown> | null)?.[key]
  const has = (key: string) => key in body
  const strField = (key: string, fallback: string) => {
    const raw = has(key) ? body[key] : getExisting(key)
    return String(raw ?? '').trim() || fallback
  }
  const trimStr = (key: string) => {
    const raw = has(key) ? body[key] : getExisting(key)
    return String(raw ?? '').trim()
  }
  const strArr = (key: string): string[] => {
    const raw = has(key) ? body[key] : getExisting(key)
    return Array.isArray(raw)
      ? raw.map((item: unknown) => String(item ?? '').trim()).filter((value: string) => value.length > 0)
      : []
  }

  return { has, strField, trimStr, strArr }
}

export function resolveColorSettings(
  body: Record<string, unknown>,
  existing: SiteConfigRecord | null,
) {
  let profileOnlineAccentColor: string | null =
    normalizeProfileOnlineAccentColor(existing?.profileOnlineAccentColor ?? '') ?? null
  if ('profileOnlineAccentColor' in body) {
    if (body.profileOnlineAccentColor === null || body.profileOnlineAccentColor === '') {
      profileOnlineAccentColor = null
    } else if (typeof body.profileOnlineAccentColor === 'string') {
      const normalized = normalizeProfileOnlineAccentColor(body.profileOnlineAccentColor)
      if (!normalized) {
        const error = new Error('Invalid profile online accent color. Expected #RRGGBB.')
        ;(error as any).status = 400
        throw error
      }
      profileOnlineAccentColor = normalized
    }
  }

  let profileOnlinePulseEnabled = existing?.profileOnlinePulseEnabled !== false
  if (body.profileOnlinePulseEnabled !== undefined && body.profileOnlinePulseEnabled !== null) {
    profileOnlinePulseEnabled = Boolean(body.profileOnlinePulseEnabled)
  }

  let adminThemeColor: string | null =
    normalizeAdminThemeColor(existing?.adminThemeColor ?? '') ?? null
  if ('adminThemeColor' in body) {
    if (body.adminThemeColor === null || body.adminThemeColor === '') {
      adminThemeColor = null
    } else if (typeof body.adminThemeColor === 'string') {
      const normalized = normalizeAdminThemeColor(body.adminThemeColor)
      if (!normalized) {
        const error = new Error('Invalid admin theme color. Expected #RRGGBB.')
        ;(error as any).status = 400
        throw error
      }
      adminThemeColor = normalized
    }
  }

  let adminBackgroundColor: string | null =
    normalizeAdminThemeColor(existing?.adminBackgroundColor ?? '') ?? null
  if ('adminBackgroundColor' in body) {
    if (body.adminBackgroundColor === null || body.adminBackgroundColor === '') {
      adminBackgroundColor = null
    } else if (typeof body.adminBackgroundColor === 'string') {
      const normalized = normalizeAdminThemeColor(body.adminBackgroundColor)
      if (!normalized) {
        const error = new Error('Invalid admin background color. Expected #RRGGBB.')
        ;(error as any).status = 400
        throw error
      }
      adminBackgroundColor = normalized
    }
  }

  return {
    profileOnlineAccentColor,
    profileOnlinePulseEnabled,
    adminThemeColor,
    adminBackgroundColor,
  }
}

export function resolveTodayStatusSettings(
  body: Record<string, unknown>,
  existing: SiteConfigRecord | null,
) {
  let todayStatusEmoji = normalizeTodayStatusEmoji(existing?.todayStatusEmoji)
  if ('todayStatusEmoji' in body) {
    todayStatusEmoji = normalizeTodayStatusEmoji(body.todayStatusEmoji)
  }

  let todayStatusText = normalizeTodayStatusText(existing?.todayStatusText)
  if ('todayStatusText' in body) {
    todayStatusText = normalizeTodayStatusText(body.todayStatusText)
  }

  let todayStatusExpiresAt = normalizeTodayStatusExpiresAt(existing?.todayStatusExpiresAt)
  if ('todayStatusExpiresAt' in body) {
    todayStatusExpiresAt = normalizeTodayStatusExpiresAt(body.todayStatusExpiresAt)
  }

  let todayStatusBusy = normalizeTodayStatusBusy(existing?.todayStatusBusy)
  if ('todayStatusBusy' in body) {
    todayStatusBusy = normalizeTodayStatusBusy(body.todayStatusBusy)
  }

  return {
    todayStatusEmoji,
    todayStatusText,
    todayStatusExpiresAt,
    todayStatusBusy,
  }
}
