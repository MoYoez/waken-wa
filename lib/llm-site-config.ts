import bcrypt from 'bcryptjs'

import { REDIS_ACTIVITY_FEED_CACHE_TTL_DEFAULT_SECONDS } from '@/lib/activity-api-constants'
import { clearActivityFeedDataCache } from '@/lib/activity-feed'
import { normalizeActivityUpdateMode } from '@/lib/activity-update-mode'
import { normalizeAdminThemeColor } from '@/lib/admin-theme-color'
import { isRemoteAvatarUrl } from '@/lib/avatar-url'
import {
  isRedisCacheForcedOnServerless,
  mergeRedisCacheAdminFields,
  parseRedisCacheTtlSeconds,
} from '@/lib/cache-runtime-toggle'
import { DEFAULT_PAGE_TITLE, PAGE_TITLE_MAX_LEN } from '@/lib/default-page-title'
import { normalizeHitokotoCategories, normalizeHitokotoEncode } from '@/lib/hitokoto'
import { normalizeInspirationAllowedHashes } from '@/lib/inspiration-device-allowlist'
import { normalizeProfileOnlineAccentColor } from '@/lib/profile-online-accent-color'
import { normalizePublicPageFontOptions } from '@/lib/public-page-font'
import { safeSiteConfigUpsert } from '@/lib/safe-site-config-upsert'
import {
  backfillCoursePeriodIdsFromTemplate,
  defaultSchedulePeriodTemplate,
  isAllowedSlotMinutes,
  MAX_SCHEDULE_ICS_BYTES,
  parseScheduleCoursesJson,
  parseSchedulePeriodTemplateJson,
  validateCoursePeriodIdsAgainstTemplate,
} from '@/lib/schedule-courses'
import {
  defaultScheduleGridByWeekday,
  minIntervalFromGrid,
  normalizeScheduleGridByWeekday,
} from '@/lib/schedule-grid-by-weekday'
import { getSiteConfigMemoryFirst } from '@/lib/site-config-cache'
import {
  parseHistoryWindowMinutes,
  parseProcessStaleSeconds,
  SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_DEFAULT,
  SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_MAX_LEN,
  SITE_CONFIG_SCHEDULE_SLOT_DEFAULT_MINUTES,
} from '@/lib/site-config-constants'
import { normalizeSiteConfigShape } from '@/lib/site-config-normalize'
import { normalizeCustomCss } from '@/lib/theme-css'
import { parseThemeCustomSurface } from '@/lib/theme-custom-surface'
import { normalizeTimezone } from '@/lib/timezone'

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

type SiteConfigRecord = Record<string, any>

function ensureJsonObject(body: Record<string, unknown>) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    const error = new Error('请求体必须为 JSON 对象')
    ;(error as any).status = 400
    throw error
  }
}

function assertAllowedLlmFields(
  body: Record<string, unknown>,
  options?: { allowRestrictedFields?: boolean },
) {
  if (options?.allowRestrictedFields) return

  const denied = new Set<string>(LLM_DENIED_SITE_CONFIG_KEYS)
  const presentDeniedKeys = Object.keys(body ?? {}).filter((k) => denied.has(k))
  if (presentDeniedKeys.length > 0) {
    const error = new Error(`该请求包含禁止由 AI Skills 修改的字段: ${presentDeniedKeys.join(', ')}`)
    ;(error as any).status = 403
    ;(error as any).deniedKeys = presentDeniedKeys
    throw error
  }
}

function normalizeAiToolMode(raw: unknown): 'skills' | 'mcp' {
  return String(raw ?? '').trim().toLowerCase() === 'mcp' ? 'mcp' : 'skills'
}

function redactSiteConfigForClient(config: SiteConfigRecord) {
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

async function getNormalizedExistingSiteConfig(): Promise<SiteConfigRecord | null> {
  const existingRaw = await getSiteConfigMemoryFirst()
  return existingRaw ? normalizeSiteConfigShape(existingRaw as SiteConfigRecord) : null
}

export async function updateSiteConfigFromPayload(
  body: Record<string, unknown>,
  options?: { allowRestrictedFields?: boolean },
) {
  ensureJsonObject(body)
  assertAllowedLlmFields(body, options)

  const existing = await getNormalizedExistingSiteConfig()

  const has = (k: string) => k in body
  const strField = (k: string, fallback: string) => {
    const raw = has(k) ? body[k] : (existing as Record<string, unknown> | null)?.[k]
    return String(raw ?? '').trim() || fallback
  }
  const trimStr = (k: string) => {
    const raw = has(k) ? body[k] : (existing as Record<string, unknown> | null)?.[k]
    return String(raw ?? '').trim()
  }
  const strArr = (k: string): string[] => {
    const raw = has(k) ? body[k] : (existing as Record<string, unknown> | null)?.[k]
    return Array.isArray(raw)
      ? raw.map((item: unknown) => String(item ?? '').trim()).filter((s: string) => s.length > 0)
      : []
  }

  const pageTitle = strField('pageTitle', DEFAULT_PAGE_TITLE).slice(0, PAGE_TITLE_MAX_LEN)
  const userName = trimStr('userName')
  const userBio = trimStr('userBio')
  const avatarUrl = trimStr('avatarUrl')
  let avatarFetchByServerEnabled =
    isRemoteAvatarUrl(avatarUrl) && existing?.avatarFetchByServerEnabled === true
  if (body.avatarFetchByServerEnabled !== undefined && body.avatarFetchByServerEnabled !== null) {
    avatarFetchByServerEnabled =
      isRemoteAvatarUrl(avatarUrl) && Boolean(body.avatarFetchByServerEnabled)
  }
  const userNote = trimStr('userNote')
  const themePreset = strField('themePreset', 'basic')
  const themeCustomSurface = parseThemeCustomSurface(
    has('themeCustomSurface') ? body.themeCustomSurface : existing?.themeCustomSurface,
  )
  const publicFontOptionsEnabled = has('publicFontOptionsEnabled')
    ? Boolean(body.publicFontOptionsEnabled)
    : existing?.publicFontOptionsEnabled === true
  const publicFontOptions = normalizePublicPageFontOptions(
    has('publicFontOptions') ? body.publicFontOptions : existing?.publicFontOptions,
  )
  const customCss = normalizeCustomCss(has('customCss') ? body.customCss : existing?.customCss)
  const aiToolMode = normalizeAiToolMode(has('aiToolMode') ? body.aiToolMode : existing?.aiToolMode)
  const mcpThemeToolsEnabled =
    aiToolMode === 'mcp' &&
    (has('mcpThemeToolsEnabled')
      ? Boolean(body.mcpThemeToolsEnabled)
      : Boolean(existing?.mcpThemeToolsEnabled))
  const openApiDocsEnabled = has('openApiDocsEnabled')
    ? Boolean(body.openApiDocsEnabled)
    : existing?.openApiDocsEnabled !== false
  const currentlyText = strField('currentlyText', '当前状态')
  const earlierText = strField('earlierText', '最近的随想录')
  const adminText = strField('adminText', 'admin')
  const pageLockEnabled = has('pageLockEnabled')
    ? Boolean(body.pageLockEnabled)
    : Boolean(existing?.pageLockEnabled)
  const autoAcceptNewDevices = has('autoAcceptNewDevices')
    ? Boolean(body.autoAcceptNewDevices)
    : Boolean(existing?.autoAcceptNewDevices)
  const rawPageLockPassword = has('pageLockPassword') ? String(body.pageLockPassword ?? '') : ''
  const appMessageRules = has('appMessageRules')
    ? (Array.isArray(body.appMessageRules) ? body.appMessageRules : [])
    : (Array.isArray(existing?.appMessageRules) ? existing.appMessageRules : [])
  const appBlacklist = strArr('appBlacklist')
  const appWhitelist = strArr('appWhitelist')
  const appFilterModeRaw = has('appFilterMode')
    ? String(body.appFilterMode ?? 'blacklist').trim().toLowerCase()
    : String(existing?.appFilterMode ?? 'blacklist').trim().toLowerCase()
  const appFilterMode = appFilterModeRaw === 'whitelist' ? 'whitelist' : 'blacklist'
  const appNameOnlyList = strArr('appNameOnlyList')
  const mediaPlaySourceBlocklist = strArr('mediaPlaySourceBlocklist')
  const historyWindowMinutes = parseHistoryWindowMinutes(
    has('historyWindowMinutes') ? body.historyWindowMinutes : existing?.historyWindowMinutes,
  )
  const processStaleSeconds = parseProcessStaleSeconds(
    has('processStaleSeconds') ? body.processStaleSeconds : existing?.processStaleSeconds,
  )

  let captureReportedAppsEnabled = existing?.captureReportedAppsEnabled !== false
  if (body.captureReportedAppsEnabled !== undefined && body.captureReportedAppsEnabled !== null) {
    captureReportedAppsEnabled = Boolean(body.captureReportedAppsEnabled)
  }

  let inspirationAllowedDeviceHashes: string[] | null = normalizeInspirationAllowedHashes(
    existing?.inspirationAllowedDeviceHashes ?? null,
  )
  if ('inspirationAllowedDeviceHashes' in body) {
    if (body.inspirationAllowedDeviceHashes === null) {
      inspirationAllowedDeviceHashes = null
    } else if (Array.isArray(body.inspirationAllowedDeviceHashes)) {
      inspirationAllowedDeviceHashes =
        normalizeInspirationAllowedHashes(body.inspirationAllowedDeviceHashes) ?? []
    }
  }

  let scheduleSlotMinutes =
    typeof existing?.scheduleSlotMinutes === 'number'
      ? existing.scheduleSlotMinutes
      : SITE_CONFIG_SCHEDULE_SLOT_DEFAULT_MINUTES
  const existingTemplateParsed = parseSchedulePeriodTemplateJson(
    existing?.schedulePeriodTemplate ?? null,
  )
  let schedulePeriodTemplate = existingTemplateParsed.ok
    ? existingTemplateParsed.data
    : defaultSchedulePeriodTemplate()
  if (body.schedulePeriodTemplate !== undefined) {
    const parsedTemplate = parseSchedulePeriodTemplateJson(body.schedulePeriodTemplate)
    if (!parsedTemplate.ok) {
      const error = new Error(parsedTemplate.error)
      ;(error as any).status = 400
      throw error
    }
    schedulePeriodTemplate = parsedTemplate.data
  }
  let scheduleGridByWeekday: unknown = existing?.scheduleGridByWeekday ?? null

  const slotInBody = body.scheduleSlotMinutes !== undefined && body.scheduleSlotMinutes !== null
  const gridInBody =
    body.scheduleGridByWeekday !== undefined && body.scheduleGridByWeekday !== null

  if (slotInBody) {
    const s = Number(body.scheduleSlotMinutes)
    if (!isAllowedSlotMinutes(s)) {
      const error = new Error('Invalid schedule slot (use 15, 30, 45, or 60 minutes)')
      ;(error as any).status = 400
      throw error
    }
    scheduleSlotMinutes = s
  }

  if (gridInBody) {
    const normalized = normalizeScheduleGridByWeekday(
      body.scheduleGridByWeekday,
      scheduleSlotMinutes,
    )
    if (!normalized.ok) {
      const error = new Error(normalized.error)
      ;(error as any).status = 400
      throw error
    }
    scheduleGridByWeekday = normalized.data
    scheduleSlotMinutes = minIntervalFromGrid(normalized.data)
  } else if (slotInBody) {
    scheduleGridByWeekday = defaultScheduleGridByWeekday(scheduleSlotMinutes)
  }

  let scheduleCoursesParsed = parseScheduleCoursesJson(existing?.scheduleCourses ?? null)
  if (!scheduleCoursesParsed.ok) {
    scheduleCoursesParsed = { ok: true, data: [] }
  }
  let scheduleCourses = scheduleCoursesParsed.data
  if (body.scheduleCourses !== undefined) {
    const parsed = parseScheduleCoursesJson(body.scheduleCourses)
    if (!parsed.ok) {
      const error = new Error(parsed.error)
      ;(error as any).status = 400
      throw error
    }
    scheduleCourses = parsed.data
  }
  const backfilled = backfillCoursePeriodIdsFromTemplate(scheduleCourses, schedulePeriodTemplate)
  scheduleCourses = backfilled.courses
  const periodValidation = validateCoursePeriodIdsAgainstTemplate(
    scheduleCourses,
    schedulePeriodTemplate,
  )
  if (!periodValidation.ok) {
    const error = new Error(periodValidation.error)
    ;(error as any).status = 400
    throw error
  }

  let scheduleIcs: string | null =
    typeof existing?.scheduleIcs === 'string' && existing.scheduleIcs.length > 0
      ? existing.scheduleIcs
      : null
  if (body.scheduleIcs !== undefined) {
    const raw = body.scheduleIcs === null || body.scheduleIcs === undefined ? '' : String(body.scheduleIcs)
    if (raw.length > MAX_SCHEDULE_ICS_BYTES) {
      const error = new Error(`scheduleIcs exceeds ${MAX_SCHEDULE_ICS_BYTES} bytes`)
      ;(error as any).status = 400
      throw error
    }
    scheduleIcs = raw.length > 0 ? raw : null
  }

  let scheduleInClassOnHome = Boolean(existing?.scheduleInClassOnHome)
  if (body.scheduleInClassOnHome !== undefined && body.scheduleInClassOnHome !== null) {
    scheduleInClassOnHome = Boolean(body.scheduleInClassOnHome)
  }
  let scheduleHomeShowLocation = Boolean(existing?.scheduleHomeShowLocation)
  if (body.scheduleHomeShowLocation !== undefined && body.scheduleHomeShowLocation !== null) {
    scheduleHomeShowLocation = Boolean(body.scheduleHomeShowLocation)
  }
  let scheduleHomeShowTeacher = Boolean(existing?.scheduleHomeShowTeacher)
  if (body.scheduleHomeShowTeacher !== undefined && body.scheduleHomeShowTeacher !== null) {
    scheduleHomeShowTeacher = Boolean(body.scheduleHomeShowTeacher)
  }
  let scheduleHomeShowNextUpcoming = Boolean(existing?.scheduleHomeShowNextUpcoming)
  if (
    body.scheduleHomeShowNextUpcoming !== undefined &&
    body.scheduleHomeShowNextUpcoming !== null
  ) {
    scheduleHomeShowNextUpcoming = Boolean(body.scheduleHomeShowNextUpcoming)
  }

  let scheduleHomeAfterClassesLabel = SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_DEFAULT
  const existingLabel = existing?.scheduleHomeAfterClassesLabel
  if (typeof existingLabel === 'string' && existingLabel.trim().length > 0) {
    scheduleHomeAfterClassesLabel = existingLabel
      .trim()
      .slice(0, SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_MAX_LEN)
  }
  if (
    body.scheduleHomeAfterClassesLabel !== undefined &&
    body.scheduleHomeAfterClassesLabel !== null
  ) {
    const raw = String(body.scheduleHomeAfterClassesLabel).trim()
    scheduleHomeAfterClassesLabel = (
      raw.length > 0 ? raw : SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_DEFAULT
    ).slice(0, SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_MAX_LEN)
  }

  let appMessageRulesShowProcessName = existing?.appMessageRulesShowProcessName !== false
  if (
    body.appMessageRulesShowProcessName !== undefined &&
    body.appMessageRulesShowProcessName !== null
  ) {
    appMessageRulesShowProcessName = Boolean(body.appMessageRulesShowProcessName)
  }

  let userNoteHitokotoEnabled = Boolean(existing?.userNoteHitokotoEnabled)
  if (body.userNoteHitokotoEnabled !== undefined && body.userNoteHitokotoEnabled !== null) {
    userNoteHitokotoEnabled = Boolean(body.userNoteHitokotoEnabled)
  }
  let userNoteTypewriterEnabled = Boolean(existing?.userNoteTypewriterEnabled)
  if (body.userNoteTypewriterEnabled !== undefined && body.userNoteTypewriterEnabled !== null) {
    userNoteTypewriterEnabled = Boolean(body.userNoteTypewriterEnabled)
  }
  let userNoteSignatureFontEnabled = Boolean(existing?.userNoteSignatureFontEnabled)
  if (
    body.userNoteSignatureFontEnabled !== undefined &&
    body.userNoteSignatureFontEnabled !== null
  ) {
    userNoteSignatureFontEnabled = Boolean(body.userNoteSignatureFontEnabled)
  }
  let userNoteSignatureFontFamily =
    typeof existing?.userNoteSignatureFontFamily === 'string'
      ? existing.userNoteSignatureFontFamily.trim().slice(0, 160)
      : ''
  if (body.userNoteSignatureFontFamily !== undefined && body.userNoteSignatureFontFamily !== null) {
    userNoteSignatureFontFamily = String(body.userNoteSignatureFontFamily).trim().slice(0, 160)
  }
  let pageLoadingEnabled = existing?.pageLoadingEnabled !== false
  if (body.pageLoadingEnabled !== undefined && body.pageLoadingEnabled !== null) {
    pageLoadingEnabled = Boolean(body.pageLoadingEnabled)
  }
  let searchEngineIndexingEnabled = existing?.searchEngineIndexingEnabled !== false
  if (
    body.searchEngineIndexingEnabled !== undefined &&
    body.searchEngineIndexingEnabled !== null
  ) {
    searchEngineIndexingEnabled = Boolean(body.searchEngineIndexingEnabled)
  }

  let userNoteHitokotoCategories = normalizeHitokotoCategories(
    existing?.userNoteHitokotoCategories ?? [],
  )
  if (body.userNoteHitokotoCategories !== undefined) {
    userNoteHitokotoCategories = normalizeHitokotoCategories(body.userNoteHitokotoCategories)
  }

  let userNoteHitokotoEncode = normalizeHitokotoEncode(existing?.userNoteHitokotoEncode)
  if (body.userNoteHitokotoEncode !== undefined && body.userNoteHitokotoEncode !== null) {
    userNoteHitokotoEncode = normalizeHitokotoEncode(body.userNoteHitokotoEncode)
  }

  let userNoteHitokotoFallbackToNote = existing?.userNoteHitokotoFallbackToNote === true
  if (
    body.userNoteHitokotoFallbackToNote !== undefined &&
    body.userNoteHitokotoFallbackToNote !== null
  ) {
    userNoteHitokotoFallbackToNote = Boolean(body.userNoteHitokotoFallbackToNote)
  }

  if (!userName || !userBio || !avatarUrl) {
    const error = new Error('请填写首页必填信息')
    ;(error as any).status = 400
    throw error
  }

  const pageLockPasswordHash =
    rawPageLockPassword.trim().length > 0
      ? await bcrypt.hash(rawPageLockPassword.trim(), 12)
      : existing?.pageLockPasswordHash ?? null

  if (pageLockEnabled && !pageLockPasswordHash) {
    const error = new Error('启用页面锁时请先设置访问密码')
    ;(error as any).status = 400
    throw error
  }

  let hcaptchaEnabled = Boolean(existing?.hcaptchaEnabled)
  if (body.hcaptchaEnabled !== undefined && body.hcaptchaEnabled !== null) {
    hcaptchaEnabled = Boolean(body.hcaptchaEnabled)
  }
  let hcaptchaSiteKey: string | null = existing?.hcaptchaSiteKey ?? null
  if (body.hcaptchaSiteKey !== undefined) {
    hcaptchaSiteKey =
      typeof body.hcaptchaSiteKey === 'string' && body.hcaptchaSiteKey.trim()
        ? body.hcaptchaSiteKey.trim()
        : null
  }
  let hcaptchaSecretKey: string | null = existing?.hcaptchaSecretKey ?? null
  if (body.hcaptchaSecretKey !== undefined) {
    hcaptchaSecretKey =
      typeof body.hcaptchaSecretKey === 'string' && body.hcaptchaSecretKey.trim()
        ? body.hcaptchaSecretKey.trim()
        : null
  }

  if (hcaptchaEnabled && (!hcaptchaSiteKey || !hcaptchaSecretKey)) {
    const error = new Error('启用 hCaptcha 时请填写 Site Key 和 Secret Key')
    ;(error as any).status = 400
    throw error
  }

  let globalMouseTiltEnabled = existing?.globalMouseTiltEnabled === true
  if (body.globalMouseTiltEnabled !== undefined && body.globalMouseTiltEnabled !== null) {
    globalMouseTiltEnabled = Boolean(body.globalMouseTiltEnabled)
  }

  let globalMouseTiltGyroEnabled = existing?.globalMouseTiltGyroEnabled === true
  if (body.globalMouseTiltGyroEnabled !== undefined && body.globalMouseTiltGyroEnabled !== null) {
    globalMouseTiltGyroEnabled = Boolean(body.globalMouseTiltGyroEnabled)
  }

  let smoothScrollEnabled = existing?.smoothScrollEnabled === true
  if (body.smoothScrollEnabled !== undefined && body.smoothScrollEnabled !== null) {
    smoothScrollEnabled = Boolean(body.smoothScrollEnabled)
  }

  let hideActivityMedia = existing?.hideActivityMedia === true
  if (body.hideActivityMedia !== undefined && body.hideActivityMedia !== null) {
    hideActivityMedia = Boolean(body.hideActivityMedia)
  }

  let hideInspirationOnHome = existing?.hideInspirationOnHome === true
  if (body.hideInspirationOnHome !== undefined && body.hideInspirationOnHome !== null) {
    hideInspirationOnHome = Boolean(body.hideInspirationOnHome)
  }

  let displayTimezone = existing?.displayTimezone ?? 'Asia/Shanghai'
  if (body.displayTimezone !== undefined && body.displayTimezone !== null) {
    displayTimezone = normalizeTimezone(body.displayTimezone)
  }
  let forceDisplayTimezone = existing?.forceDisplayTimezone === true
  if (body.forceDisplayTimezone !== undefined && body.forceDisplayTimezone !== null) {
    forceDisplayTimezone = Boolean(body.forceDisplayTimezone)
  }

  let activityUpdateMode = existing?.activityUpdateMode ?? 'sse'
  if (body.activityUpdateMode !== undefined && body.activityUpdateMode !== null) {
    activityUpdateMode = normalizeActivityUpdateMode(body.activityUpdateMode)
  }
  let useNoSqlAsCacheRedis = existing?.useNoSqlAsCacheRedis === true
  if (body.useNoSqlAsCacheRedis !== undefined && body.useNoSqlAsCacheRedis !== null) {
    useNoSqlAsCacheRedis = Boolean(body.useNoSqlAsCacheRedis)
  }
  if (isRedisCacheForcedOnServerless()) {
    useNoSqlAsCacheRedis = true
  }
  let redisCacheTtlSeconds = parseRedisCacheTtlSeconds(
    existing?.redisCacheTtlSeconds ?? REDIS_ACTIVITY_FEED_CACHE_TTL_DEFAULT_SECONDS,
  )
  if (body.redisCacheTtlSeconds !== undefined && body.redisCacheTtlSeconds !== null) {
    redisCacheTtlSeconds = parseRedisCacheTtlSeconds(body.redisCacheTtlSeconds)
  }

  let steamEnabled = existing?.steamEnabled ?? false
  if (body.steamEnabled !== undefined) {
    steamEnabled = Boolean(body.steamEnabled)
  }
  let steamId = existing?.steamId ?? null
  if (body.steamId !== undefined) {
    steamId = body.steamId ? String(body.steamId).trim() : null
  }

  const STEAM_API_KEY_MAX_LEN = 128
  let steamApiKey: string | null = existing?.steamApiKey ?? null
  if (body.steamApiKey !== undefined) {
    steamApiKey =
      typeof body.steamApiKey === 'string' && body.steamApiKey.trim()
        ? body.steamApiKey.trim().slice(0, STEAM_API_KEY_MAX_LEN)
        : null
  }

  let activityRejectLockappSleep = existing?.activityRejectLockappSleep === true
  if (body.activityRejectLockappSleep !== undefined && body.activityRejectLockappSleep !== null) {
    activityRejectLockappSleep = Boolean(body.activityRejectLockappSleep)
  }

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

  const siteConfigValues = {
    adminThemeColor,
    adminBackgroundColor,
    pageTitle,
    userName,
    userBio,
    avatarUrl,
    avatarFetchByServerEnabled,
    profileOnlineAccentColor,
    profileOnlinePulseEnabled,
    userNote,
    userNoteHitokotoEnabled,
    userNoteTypewriterEnabled,
    userNoteSignatureFontEnabled,
    userNoteSignatureFontFamily,
    pageLoadingEnabled,
    searchEngineIndexingEnabled,
    userNoteHitokotoCategories,
    userNoteHitokotoEncode,
    userNoteHitokotoFallbackToNote,
    themePreset,
    themeCustomSurface,
    publicFontOptionsEnabled,
    publicFontOptions,
    customCss,
    mcpThemeToolsEnabled,
    openApiDocsEnabled,
    aiToolMode,
    historyWindowMinutes,
    appMessageRules,
    appMessageRulesShowProcessName,
    appBlacklist,
    appWhitelist,
    appFilterMode,
    appNameOnlyList,
    captureReportedAppsEnabled,
    mediaPlaySourceBlocklist,
    processStaleSeconds,
    pageLockEnabled,
    pageLockPasswordHash,
    currentlyText,
    earlierText,
    adminText,
    autoAcceptNewDevices,
    inspirationAllowedDeviceHashes,
    scheduleSlotMinutes,
    schedulePeriodTemplate,
    scheduleGridByWeekday,
    scheduleCourses,
    scheduleIcs,
    scheduleInClassOnHome,
    scheduleHomeShowLocation,
    scheduleHomeShowTeacher,
    scheduleHomeShowNextUpcoming,
    scheduleHomeAfterClassesLabel,
    globalMouseTiltEnabled,
    globalMouseTiltGyroEnabled,
    smoothScrollEnabled,
    hideActivityMedia,
    hideInspirationOnHome,
    hcaptchaEnabled,
    hcaptchaSiteKey,
    hcaptchaSecretKey,
    displayTimezone,
    forceDisplayTimezone,
    activityUpdateMode,
    useNoSqlAsCacheRedis,
    redisCacheTtlSeconds,
    steamEnabled,
    steamId,
    steamApiKey,
    activityRejectLockappSleep,
  }

  const upsertResult = await safeSiteConfigUpsert({
    where: { id: 1 },
    update: siteConfigValues,
    create: {
      id: 1,
      ...siteConfigValues,
    },
  })
  if (upsertResult.strippedColumns.length > 0) {
    console.warn(
      `[site-config] unknown DB columns stripped during upsert: ${upsertResult.strippedColumns.join(', ')}`,
    )
  }
  await clearActivityFeedDataCache()

  const config = await getSiteConfigMemoryFirst()
  if (!config) {
    const error = new Error('站点配置不存在')
    ;(error as any).status = 500
    throw error
  }

  const redacted = redactSiteConfigForClient(config as SiteConfigRecord)
  if (upsertResult.strippedColumns.length === 0) {
    return redacted
  }
  return {
    ...redacted,
    schemaWarnings: {
      strippedColumns: upsertResult.strippedColumns,
    },
  }
}
