import { normalizeAdminThemeColor } from '@/lib/admin-theme-color'
import { mergeRedisCacheAdminFields } from '@/lib/cache-runtime-toggle'
import { normalizeProfileOnlineAccentColor } from '@/lib/profile-online-accent-color'
import { getSiteConfigMemoryFirst } from '@/lib/site-config-cache'
import { normalizeSiteConfigShape } from '@/lib/site-config-normalize'

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
] as const

export type SiteConfigRecord = Record<string, any>

export function ensureJsonObject(body: Record<string, unknown>) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    const error = new Error('请求体必须为 JSON 对象')
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
    const error = new Error(`该请求包含禁止由 AI Skills 修改的字段: ${presentDeniedKeys.join(', ')}`)
    ;(error as any).status = 403
    ;(error as any).deniedKeys = presentDeniedKeys
    throw error
  }
}

export function normalizeAiToolMode(raw: unknown): 'skills' | 'mcp' {
  return String(raw ?? '').trim().toLowerCase() === 'mcp' ? 'mcp' : 'skills'
}

export function redactSiteConfigForClient(config: SiteConfigRecord) {
  const normalized = normalizeSiteConfigShape(config) as SiteConfigRecord
  const redisAdmin = mergeRedisCacheAdminFields(normalized)
  return {
    ...normalized,
    pageLockPasswordHash: undefined,
    hcaptchaSecretKey: normalized.hcaptchaSecretKey ? '••••••••' : null,
    steamApiKey: normalized.steamApiKey ? '••••••••' : null,
    useNoSqlAsCacheRedis: redisAdmin.useNoSqlAsCacheRedis,
    redisCacheServerlessForced: redisAdmin.redisCacheServerlessForced,
  }
}

export async function getSafeSiteConfig() {
  const config = await getSiteConfigMemoryFirst()
  if (!config) return null
  return redactSiteConfigForClient(config as SiteConfigRecord)
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
        const error = new Error('无效的头像在线色（需 #RRGGBB）')
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
        const error = new Error('后台主题色无效（需 #RRGGBB）')
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
        const error = new Error('后台背景色无效（需 #RRGGBB）')
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
