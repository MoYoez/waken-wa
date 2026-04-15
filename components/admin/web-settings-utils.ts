import type {
  SiteConfig,
  SkillsAiAuthorizationItem,
  SkillsEditableConfig,
  ThemeCustomSurfaceForm,
} from '@/components/admin/web-settings-types'
import {
  REDIS_ACTIVITY_FEED_CACHE_TTL_MAX_SECONDS,
} from '@/lib/activity-api-constants'
import { normalizeAdminThemeColor } from '@/lib/admin-theme-color'
import {
  type AppMessageRuleGroup,
  normalizeAppMessageRules,
} from '@/lib/app-message-rules'
import { isRemoteAvatarUrl } from '@/lib/avatar-url'
import { DEFAULT_PAGE_TITLE, PAGE_TITLE_MAX_LEN } from '@/lib/default-page-title'
import {
  normalizeHitokotoCategories,
  normalizeHitokotoEncode,
} from '@/lib/hitokoto'
import { normalizeProfileOnlineAccentColor } from '@/lib/profile-online-accent-color'
import {
  isAllowedSlotMinutes,
  resolveSchedulePeriodTemplate,
  type ScheduleCourse,
} from '@/lib/schedule-courses'
import { resolveScheduleGridByWeekday } from '@/lib/schedule-grid-by-weekday'
import {
  clampSiteConfigHistoryWindowMinutes,
  clampSiteConfigProcessStaleSeconds,
  SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_DEFAULT,
  SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_MAX_LEN,
  SITE_CONFIG_SCHEDULE_SLOT_DEFAULT_MINUTES,
} from '@/lib/site-config-constants'
import {
  parseThemeCustomSurface,
  THEME_CUSTOM_SURFACE_DEFAULTS,
} from '@/lib/theme-custom-surface'
import { formatDisplayPattern } from '@/lib/timezone'

export function emptyThemeCustomSurfaceForm(): ThemeCustomSurfaceForm {
  return {
    background: '',
    bodyBackground: '',
    animatedBg: '',
    primary: '',
    secondary: '',
    accent: '',
    online: '',
    foreground: '',
    card: '',
    border: '',
    muted: '',
    mutedForeground: '',
    homeCardOverlay: '',
    homeCardOverlayDark: '',
    homeCardInsetHighlight: '',
    animatedBgTint1: '',
    animatedBgTint2: '',
    animatedBgTint3: '',
    floatingOrbColor1: '',
    floatingOrbColor2: '',
    floatingOrbColor3: '',
    radius: '',
    hideFloatingOrbs: THEME_CUSTOM_SURFACE_DEFAULTS.hideFloatingOrbs,
    transparentAnimatedBg: false,
    backgroundImageMode: THEME_CUSTOM_SURFACE_DEFAULTS.backgroundImageMode,
    backgroundImageUrl: '',
    backgroundImagePool: [],
    backgroundRandomApiUrl: '',
    paletteMode: THEME_CUSTOM_SURFACE_DEFAULTS.paletteMode,
    paletteLiveEnabled: THEME_CUSTOM_SURFACE_DEFAULTS.paletteLiveEnabled,
    paletteLiveScope: THEME_CUSTOM_SURFACE_DEFAULTS.paletteLiveScope,
    paletteSeedImageUrl: '',
  }
}

export function themeCustomSurfaceFromApi(raw: unknown): ThemeCustomSurfaceForm {
  const p = parseThemeCustomSurface(raw)
  return {
    background: p.background || '',
    bodyBackground: p.bodyBackground || '',
    animatedBg: p.animatedBg || '',
    primary: p.primary || '',
    secondary: p.secondary || '',
    accent: p.accent || '',
    online: p.online || '',
    foreground: p.foreground || '',
    card: p.card || '',
    border: p.border || '',
    muted: p.muted || '',
    mutedForeground: p.mutedForeground || '',
    homeCardOverlay: p.homeCardOverlay || '',
    homeCardOverlayDark: p.homeCardOverlayDark || '',
    homeCardInsetHighlight: p.homeCardInsetHighlight || '',
    animatedBgTint1: p.animatedBgTint1 || '',
    animatedBgTint2: p.animatedBgTint2 || '',
    animatedBgTint3: p.animatedBgTint3 || '',
    floatingOrbColor1: p.floatingOrbColor1 || '',
    floatingOrbColor2: p.floatingOrbColor2 || '',
    floatingOrbColor3: p.floatingOrbColor3 || '',
    radius: p.radius || '',
    hideFloatingOrbs:
      p.hideFloatingOrbs !== undefined
        ? p.hideFloatingOrbs
        : THEME_CUSTOM_SURFACE_DEFAULTS.hideFloatingOrbs,
    transparentAnimatedBg: p.transparentAnimatedBg === true,
    backgroundImageMode:
      p.backgroundImageMode || THEME_CUSTOM_SURFACE_DEFAULTS.backgroundImageMode,
    backgroundImageUrl: p.backgroundImageUrl || '',
    backgroundImagePool: Array.isArray(p.backgroundImagePool) ? p.backgroundImagePool : [],
    backgroundRandomApiUrl: p.backgroundRandomApiUrl || '',
    paletteMode: p.paletteMode || THEME_CUSTOM_SURFACE_DEFAULTS.paletteMode,
    paletteLiveEnabled:
      p.paletteLiveEnabled !== undefined
        ? p.paletteLiveEnabled
        : THEME_CUSTOM_SURFACE_DEFAULTS.paletteLiveEnabled,
    paletteLiveScope: p.paletteLiveScope || THEME_CUSTOM_SURFACE_DEFAULTS.paletteLiveScope,
    paletteSeedImageUrl: p.paletteSeedImageUrl || '',
  }
}

export function hasThemeImageSourceConfigured(surface: ThemeCustomSurfaceForm): boolean {
  if (surface.backgroundImageUrl.trim()) return true
  if (surface.backgroundRandomApiUrl.trim()) return true
  return surface.backgroundImagePool.some((item) => item.trim().length > 0)
}

function base64ToUtf8(b64: string): string {
  const s = b64.replace(/\s/g, '')
  const bin = atob(s)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i)
  return new TextDecoder('utf-8').decode(bytes)
}

export function parseExportPayload(encoded: string): { web: Record<string, unknown> } | null {
  let json: unknown
  try {
    json = JSON.parse(base64ToUtf8(encoded))
  } catch {
    return null
  }
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null
  const o = json as Record<string, unknown>
  if (typeof o.version === 'number' && o.version !== 1) return null
  const web = o.web
  if (!web || typeof web !== 'object' || Array.isArray(web)) return null
  return { web: web as Record<string, unknown> }
}

export function normalizeRulesImport(rules: unknown): AppMessageRuleGroup[] {
  return normalizeAppMessageRules(rules)
}

export function normalizeStringListImport(items: unknown): string[] {
  if (!Array.isArray(items)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of items) {
    const value = String(raw ?? '').trim()
    if (!value) continue
    const key = value.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(value)
  }
  return out
}

export function exportAppRulesJson(cfg: {
  appMessageRules: AppMessageRuleGroup[]
  appMessageRulesShowProcessName: boolean
  appFilterMode: 'blacklist' | 'whitelist'
  appBlacklist: string[]
  appWhitelist: string[]
  appNameOnlyList: string[]
  mediaPlaySourceBlocklist: string[]
}): string {
  return JSON.stringify(
    {
      version: 2,
      exportedAt: new Date().toISOString(),
      rules: {
        appMessageRules: cfg.appMessageRules,
        appMessageRulesShowProcessName: cfg.appMessageRulesShowProcessName,
        appFilterMode: cfg.appFilterMode,
        appBlacklist: cfg.appBlacklist,
        appWhitelist: cfg.appWhitelist,
        appNameOnlyList: cfg.appNameOnlyList,
        mediaPlaySourceBlocklist: cfg.mediaPlaySourceBlocklist,
      },
    },
    null,
    2,
  )
}

export function parseAppRulesJson(
  raw: string,
  translateError?: (key: 'parseFailed' | 'topLevelMustBeObject' | 'unsupportedVersion' | 'missingRules') => string,
):
  | {
      ok: true
      data: {
        appMessageRules: AppMessageRuleGroup[]
        appMessageRulesShowProcessName: boolean
        appFilterMode: 'blacklist' | 'whitelist'
        appBlacklist: string[]
        appWhitelist: string[]
        appNameOnlyList: string[]
        mediaPlaySourceBlocklist: string[]
      }
    }
  | { ok: false; error: string } {
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return { ok: false, error: translateError?.('parseFailed') ?? 'JSON parse failed' }
  }
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    return { ok: false, error: translateError?.('topLevelMustBeObject') ?? 'The JSON top level must be an object' }
  }
  const o = json as Record<string, unknown>
  if (typeof o.version === 'number' && o.version !== 1 && o.version !== 2) {
    return { ok: false, error: translateError?.('unsupportedVersion') ?? 'Unsupported version' }
  }
  const rules = o.rules
  if (!rules || typeof rules !== 'object' || Array.isArray(rules)) {
    return { ok: false, error: translateError?.('missingRules') ?? 'Missing rules object' }
  }
  const r = rules as Record<string, unknown>
  const appMessageRules = normalizeRulesImport(r.appMessageRules)
  const appMessageRulesShowProcessName =
    typeof r.appMessageRulesShowProcessName === 'boolean'
      ? r.appMessageRulesShowProcessName
      : true
  const modeRaw = String(r.appFilterMode ?? 'blacklist').toLowerCase()
  const appFilterMode = modeRaw === 'whitelist' ? 'whitelist' : 'blacklist'
  const appBlacklist = normalizeStringListImport(r.appBlacklist)
  const appWhitelist = normalizeStringListImport(r.appWhitelist)
  const appNameOnlyList = normalizeStringListImport(r.appNameOnlyList)
  const mediaPlaySourceBlocklist = normalizeStringListImport(r.mediaPlaySourceBlocklist).map((s) =>
    s.toLowerCase(),
  )
  return {
    ok: true,
    data: {
      appMessageRules,
      appMessageRulesShowProcessName,
      appFilterMode,
      appBlacklist,
      appWhitelist,
      appNameOnlyList,
      mediaPlaySourceBlocklist,
    },
  }
}

/** Maps export `web` object into form fields (same shape as GET /api/admin/settings). */
export function webPayloadToFormPatch(web: Record<string, unknown>): Partial<SiteConfig> {
  const patch: Partial<SiteConfig> = {}
  if ('adminThemeColor' in web) {
    patch.adminThemeColor =
      typeof web.adminThemeColor === 'string'
        ? (normalizeAdminThemeColor(web.adminThemeColor) ?? '')
        : ''
  }
  if ('adminBackgroundColor' in web) {
    patch.adminBackgroundColor =
      typeof web.adminBackgroundColor === 'string'
        ? (normalizeAdminThemeColor(web.adminBackgroundColor) ?? '')
        : ''
  }
  if ('pageTitle' in web && typeof web.pageTitle === 'string') {
    const t = web.pageTitle.trim()
    patch.pageTitle = t ? t.slice(0, PAGE_TITLE_MAX_LEN) : DEFAULT_PAGE_TITLE
  }
  if ('userName' in web && typeof web.userName === 'string') patch.userName = web.userName.trim()
  if ('userBio' in web && typeof web.userBio === 'string') patch.userBio = web.userBio.trim()
  if ('avatarUrl' in web && typeof web.avatarUrl === 'string') patch.avatarUrl = web.avatarUrl.trim()
  if ('avatarFetchByServerEnabled' in web && typeof web.avatarFetchByServerEnabled === 'boolean') {
    patch.avatarFetchByServerEnabled =
      isRemoteAvatarUrl(typeof web.avatarUrl === 'string' ? web.avatarUrl : patch.avatarUrl) &&
      web.avatarFetchByServerEnabled
  }
  if ('profileOnlineAccentColor' in web) {
    if (web.profileOnlineAccentColor === null || web.profileOnlineAccentColor === '') {
      patch.profileOnlineAccentColor = ''
    } else if (typeof web.profileOnlineAccentColor === 'string') {
      const n = normalizeProfileOnlineAccentColor(web.profileOnlineAccentColor)
      patch.profileOnlineAccentColor = n ?? ''
    }
  }
  if ('profileOnlinePulseEnabled' in web && typeof web.profileOnlinePulseEnabled === 'boolean') {
    patch.profileOnlinePulseEnabled = web.profileOnlinePulseEnabled
  }
  if ('userNote' in web && typeof web.userNote === 'string') patch.userNote = web.userNote.trim()
  if ('userNoteHitokotoEnabled' in web && typeof web.userNoteHitokotoEnabled === 'boolean') {
    patch.userNoteHitokotoEnabled = web.userNoteHitokotoEnabled
  }
  if ('userNoteTypewriterEnabled' in web && typeof web.userNoteTypewriterEnabled === 'boolean') {
    patch.userNoteTypewriterEnabled = web.userNoteTypewriterEnabled
  }
  if ('userNoteSignatureFontEnabled' in web && typeof web.userNoteSignatureFontEnabled === 'boolean') {
    patch.userNoteSignatureFontEnabled = web.userNoteSignatureFontEnabled
  }
  if ('userNoteSignatureFontFamily' in web && typeof web.userNoteSignatureFontFamily === 'string') {
    patch.userNoteSignatureFontFamily = web.userNoteSignatureFontFamily.trim().slice(0, 160)
  }
  if ('userNoteHitokotoCategories' in web) {
    patch.userNoteHitokotoCategories = normalizeHitokotoCategories(web.userNoteHitokotoCategories)
  }
  if ('userNoteHitokotoEncode' in web) {
    patch.userNoteHitokotoEncode = normalizeHitokotoEncode(web.userNoteHitokotoEncode)
  }
  if ('userNoteHitokotoFallbackToNote' in web && typeof web.userNoteHitokotoFallbackToNote === 'boolean') {
    patch.userNoteHitokotoFallbackToNote = web.userNoteHitokotoFallbackToNote
  }
  if ('themePreset' in web && typeof web.themePreset === 'string') {
    patch.themePreset = web.themePreset.trim() || 'basic'
  }
  if ('themeCustomSurface' in web) {
    patch.themeCustomSurface = themeCustomSurfaceFromApi(web.themeCustomSurface)
  }
  if ('customCss' in web && typeof web.customCss === 'string') patch.customCss = web.customCss
  if ('historyWindowMinutes' in web) {
    const hw = Number(web.historyWindowMinutes)
    if (Number.isFinite(hw)) {
      patch.historyWindowMinutes = clampSiteConfigHistoryWindowMinutes(hw)
    }
  }
  if ('processStaleSeconds' in web) {
    const st = Number(web.processStaleSeconds)
    if (Number.isFinite(st)) {
      patch.processStaleSeconds = clampSiteConfigProcessStaleSeconds(st)
    }
  }
  if ('appMessageRules' in web) patch.appMessageRules = normalizeRulesImport(web.appMessageRules)
  if ('appMessageRulesShowProcessName' in web && typeof web.appMessageRulesShowProcessName === 'boolean') {
    patch.appMessageRulesShowProcessName = web.appMessageRulesShowProcessName
  }
  if ('appBlacklist' in web) patch.appBlacklist = normalizeStringListImport(web.appBlacklist)
  if ('appWhitelist' in web) patch.appWhitelist = normalizeStringListImport(web.appWhitelist)
  if ('appFilterMode' in web) {
    const mode = String(web.appFilterMode ?? '').toLowerCase()
    patch.appFilterMode = mode === 'whitelist' ? 'whitelist' : 'blacklist'
  }
  if ('appNameOnlyList' in web) patch.appNameOnlyList = normalizeStringListImport(web.appNameOnlyList)
  if ('captureReportedAppsEnabled' in web && typeof web.captureReportedAppsEnabled === 'boolean') {
    patch.captureReportedAppsEnabled = web.captureReportedAppsEnabled
  }
  if ('mediaPlaySourceBlocklist' in web) {
    patch.mediaPlaySourceBlocklist = normalizeStringListImport(web.mediaPlaySourceBlocklist).map((s) =>
      s.toLowerCase(),
    )
  }
  if ('pageLockEnabled' in web && typeof web.pageLockEnabled === 'boolean') {
    patch.pageLockEnabled = web.pageLockEnabled
  }
  if ('currentlyText' in web && typeof web.currentlyText === 'string') {
    patch.currentlyText = web.currentlyText.trim()
  }
  if ('earlierText' in web && typeof web.earlierText === 'string') {
    patch.earlierText = web.earlierText.trim()
  }
  if ('adminText' in web && typeof web.adminText === 'string') {
    patch.adminText = web.adminText.trim() || 'admin'
  }
  if ('autoAcceptNewDevices' in web && typeof web.autoAcceptNewDevices === 'boolean') {
    patch.autoAcceptNewDevices = web.autoAcceptNewDevices
  }
  if ('inspirationAllowedDeviceHashes' in web) {
    if (web.inspirationAllowedDeviceHashes === null) {
      patch.inspirationDeviceRestrictionEnabled = false
      patch.inspirationAllowedDeviceHashes = []
    } else if (Array.isArray(web.inspirationAllowedDeviceHashes)) {
      patch.inspirationDeviceRestrictionEnabled = true
      patch.inspirationAllowedDeviceHashes = web.inspirationAllowedDeviceHashes
        .map((item: unknown) => String(item ?? '').trim())
        .filter((item: string) => item.length > 0)
    }
  }
  let scheduleImportSlot = SITE_CONFIG_SCHEDULE_SLOT_DEFAULT_MINUTES
  if ('scheduleSlotMinutes' in web) {
    const s = Number(web.scheduleSlotMinutes)
    if (isAllowedSlotMinutes(s)) {
      patch.scheduleSlotMinutes = s
      scheduleImportSlot = s
    }
  }
  if ('scheduleGridByWeekday' in web && Array.isArray(web.scheduleGridByWeekday)) {
    patch.scheduleGridByWeekday = resolveScheduleGridByWeekday(
      web.scheduleGridByWeekday,
      scheduleImportSlot,
    )
  }
  if ('schedulePeriodTemplate' in web) {
    patch.schedulePeriodTemplate = resolveSchedulePeriodTemplate(web.schedulePeriodTemplate)
  }
  if ('scheduleCourses' in web && Array.isArray(web.scheduleCourses)) {
    patch.scheduleCourses = web.scheduleCourses as ScheduleCourse[]
  }
  if ('scheduleIcs' in web && web.scheduleIcs === null) {
    patch.scheduleIcs = ''
  } else if ('scheduleIcs' in web && typeof web.scheduleIcs === 'string') {
    patch.scheduleIcs = web.scheduleIcs
  }
  if ('scheduleInClassOnHome' in web && typeof web.scheduleInClassOnHome === 'boolean') {
    patch.scheduleInClassOnHome = web.scheduleInClassOnHome
  }
  if ('scheduleHomeShowLocation' in web && typeof web.scheduleHomeShowLocation === 'boolean') {
    patch.scheduleHomeShowLocation = web.scheduleHomeShowLocation
  }
  if ('scheduleHomeShowTeacher' in web && typeof web.scheduleHomeShowTeacher === 'boolean') {
    patch.scheduleHomeShowTeacher = web.scheduleHomeShowTeacher
  }
  if ('scheduleHomeShowNextUpcoming' in web && typeof web.scheduleHomeShowNextUpcoming === 'boolean') {
    patch.scheduleHomeShowNextUpcoming = web.scheduleHomeShowNextUpcoming
  }
  if ('scheduleHomeAfterClassesLabel' in web && typeof web.scheduleHomeAfterClassesLabel === 'string') {
    const t = web.scheduleHomeAfterClassesLabel.trim()
    patch.scheduleHomeAfterClassesLabel = (
      t.length > 0 ? t : SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_DEFAULT
    ).slice(0, SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_MAX_LEN)
  }
  if ('globalMouseTiltEnabled' in web && typeof web.globalMouseTiltEnabled === 'boolean') {
    patch.globalMouseTiltEnabled = web.globalMouseTiltEnabled
  }
  if ('globalMouseTiltGyroEnabled' in web && typeof web.globalMouseTiltGyroEnabled === 'boolean') {
    patch.globalMouseTiltGyroEnabled = web.globalMouseTiltGyroEnabled
  }
  if ('hideActivityMedia' in web && typeof web.hideActivityMedia === 'boolean') {
    patch.hideActivityMedia = web.hideActivityMedia
  }
  if ('activityRejectLockappSleep' in web && typeof web.activityRejectLockappSleep === 'boolean') {
    patch.activityRejectLockappSleep = web.activityRejectLockappSleep
  }
  if ('useNoSqlAsCacheRedis' in web && typeof web.useNoSqlAsCacheRedis === 'boolean') {
    patch.useNoSqlAsCacheRedis = web.useNoSqlAsCacheRedis
  }
  if ('redisCacheTtlSeconds' in web) {
    const ttl = Number(web.redisCacheTtlSeconds)
    if (Number.isFinite(ttl)) {
      patch.redisCacheTtlSeconds = Math.min(
        REDIS_ACTIVITY_FEED_CACHE_TTL_MAX_SECONDS,
        Math.max(1, Math.round(ttl)),
      )
    }
  }
  return patch
}

export function normalizeSkillsAiAuthorizations(raw: unknown): SkillsAiAuthorizationItem[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      const row = item as Record<string, unknown>
      const aiClientId = String(row.aiClientId ?? '').trim().toLowerCase()
      if (!aiClientId) return null
      const normalizeCount = (value: unknown) =>
        Number.isFinite(Number(value)) ? Math.max(0, Math.trunc(Number(value))) : 0
      const normalizeTime = (value: unknown): string | null => {
        const str = String(value ?? '').trim()
        if (!str) return null
        const date = new Date(str)
        return Number.isNaN(date.getTime()) ? null : date.toISOString()
      }
      return {
        aiClientId,
        pendingCodeCount: normalizeCount(row.pendingCodeCount),
        approvedCodeCount: normalizeCount(row.approvedCodeCount),
        activeTokenCount: normalizeCount(row.activeTokenCount),
        lastApprovedAt: normalizeTime(row.lastApprovedAt),
        lastExchangedAt: normalizeTime(row.lastExchangedAt),
      } satisfies SkillsAiAuthorizationItem
    })
    .filter((item): item is SkillsAiAuthorizationItem => item !== null)
}

export function formatIsoDatetime(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return formatDisplayPattern(date, 'yyyy-MM-dd HH:mm:ss') || '—'
}

export function normalizeSkillsEditableConfig(raw: Partial<SkillsEditableConfig>): SkillsEditableConfig {
  const authMode = raw.authMode === 'oauth' || raw.authMode === 'apikey' ? raw.authMode : ''
  const oauthTokenTtlMinutes = Number.isFinite(Number(raw.oauthTokenTtlMinutes))
    ? Math.min(1440, Math.max(5, Math.round(Number(raw.oauthTokenTtlMinutes))))
    : 60
  return {
    enabled: raw.enabled === true,
    authMode,
    oauthTokenTtlMinutes,
  }
}
