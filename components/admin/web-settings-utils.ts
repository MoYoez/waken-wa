import {
  REDIS_ACTIVITY_FEED_CACHE_TTL_MAX_SECONDS,
} from '@/constants/activity-api'
import {
  SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_DEFAULT,
  SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_MAX_LEN,
  SITE_CONFIG_SCHEDULE_SLOT_DEFAULT_MINUTES,
} from '@/constants/site-config'
import { normalizeAdminThemeColor } from '@/lib/admin-theme-color'
import {
  type AppMessageRuleGroup,
  normalizeAppMessageRules,
  stripAppMessageRuleIds,
} from '@/lib/app-message-rules'
import { isRemoteAvatarUrl } from '@/lib/avatar-url'
import { DEFAULT_PAGE_TITLE, PAGE_TITLE_MAX_LEN } from '@/lib/default-page-title'
import {
  normalizeHitokotoCategories,
  normalizeHitokotoEncode,
} from '@/lib/hitokoto'
import {
  mediaPlaySourceBlocklistFromRules,
  normalizeMediaPlaySourceRules,
} from '@/lib/media-play-source-rules'
import { normalizeProfileOnlineAccentColor } from '@/lib/profile-online-accent-color'
import { normalizePublicPageFontOptions } from '@/lib/public-page-font'
import { normalizeReportedAppTitleLimit } from '@/lib/reported-app-title-limit'
import {
  isAllowedSlotMinutes,
  resolveSchedulePeriodTemplate,
  type ScheduleCourse,
} from '@/lib/schedule-courses'
import { resolveScheduleGridByWeekday } from '@/lib/schedule-grid-by-weekday'
import {
  clampSiteConfigHistoryWindowMinutes,
  clampSiteConfigProcessStaleSeconds,
} from '@/lib/site-config-values'
import { normalizeSiteIconUrl } from '@/lib/site-icon'
import {
  normalizeStatusCardCoverKey,
  normalizeStatusCardCoverRev,
  normalizeStatusCardDimension,
  normalizeStatusCardHexColor,
  normalizeStatusCardTag,
  normalizeStatusCardVariant,
} from '@/lib/status-card-options'
import {
  parseThemeCustomSurface,
  THEME_CUSTOM_SURFACE_DEFAULTS,
} from '@/lib/theme-custom-surface'
import {
  normalizeTodayStatusBusy,
  normalizeTodayStatusEmoji,
  normalizeTodayStatusExpiresAt,
  normalizeTodayStatusText,
} from '@/lib/today-status'
import type { RuleToolsExportPayload } from '@/types/rule-tools'
import type {
  PublicPageFontOptionForm,
  SiteConfig,
  SkillsAiAuthorizationItem,
  SkillsEditableConfig,
  ThemeCustomSurfaceForm,
} from '@/types/web-settings'

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

export function emptyPublicPageFontOptionsForm(): PublicPageFontOptionForm[] {
  return [
    { label: '', family: '', mode: 'default', url: '' },
    { label: '', family: '', mode: 'google', url: '' },
  ]
}

export function publicPageFontOptionsFromApi(raw: unknown): PublicPageFontOptionForm[] {
  const defaults = emptyPublicPageFontOptionsForm()
  const parsed = normalizePublicPageFontOptions(raw)
  return defaults.map((fallback, index) => {
    const item = parsed[index]
    if (!item) return fallback
    return {
      label: item.label,
      family: item.family,
      mode: item.mode,
      url: item.url ?? '',
    }
  })
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
  appMessageRules: unknown
  appMessageRulesShowProcessName: boolean
  appFilterMode: 'blacklist' | 'whitelist'
  appBlacklist: string[]
  appWhitelist: string[]
  appNameOnlyList: string[]
  captureReportedAppsEnabled?: boolean
  captureReportedAppTitleLimit?: number
  mediaPlaySourceRules?: unknown
  mediaPlaySourceBlocklist: string[]
}): string {
  const mediaPlaySourceRules = normalizeMediaPlaySourceRules(
    cfg.mediaPlaySourceRules,
    cfg.mediaPlaySourceBlocklist,
  )
  return JSON.stringify(
    {
      version: 2,
      exportedAt: new Date().toISOString(),
      rules: {
        appMessageRules: stripAppMessageRuleIds(normalizeAppMessageRules(cfg.appMessageRules)),
        appMessageRulesShowProcessName: cfg.appMessageRulesShowProcessName,
        appFilterMode: cfg.appFilterMode,
        appBlacklist: cfg.appBlacklist,
        appWhitelist: cfg.appWhitelist,
        appNameOnlyList: cfg.appNameOnlyList,
        captureReportedAppsEnabled: cfg.captureReportedAppsEnabled !== false,
        captureReportedAppTitleLimit: normalizeReportedAppTitleLimit(
          cfg.captureReportedAppTitleLimit,
        ),
        mediaPlaySourceRules,
        mediaPlaySourceBlocklist: mediaPlaySourceBlocklistFromRules(mediaPlaySourceRules),
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
        captureReportedAppsEnabled: boolean
        captureReportedAppTitleLimit: number
        mediaPlaySourceRules: ReturnType<typeof normalizeMediaPlaySourceRules>
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
  const captureReportedAppsEnabled =
    typeof r.captureReportedAppsEnabled === 'boolean'
      ? r.captureReportedAppsEnabled
      : true
  const captureReportedAppTitleLimit = normalizeReportedAppTitleLimit(
    r.captureReportedAppTitleLimit,
  )
  const mediaPlaySourceBlocklist = normalizeStringListImport(r.mediaPlaySourceBlocklist).map((s) =>
    s.toLowerCase(),
  )
  const mediaPlaySourceRules = normalizeMediaPlaySourceRules(
    r.mediaPlaySourceRules,
    mediaPlaySourceBlocklist,
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
      captureReportedAppsEnabled,
      captureReportedAppTitleLimit,
      mediaPlaySourceRules,
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
  if ('siteIconUrl' in web) {
    patch.siteIconUrl =
      typeof web.siteIconUrl === 'string' ? (normalizeSiteIconUrl(web.siteIconUrl) ?? '') : ''
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
  if ('todayStatusEmoji' in web) {
    patch.todayStatusEmoji = normalizeTodayStatusEmoji(web.todayStatusEmoji)
  }
  if ('todayStatusText' in web) {
    patch.todayStatusText = normalizeTodayStatusText(web.todayStatusText)
  }
  if ('todayStatusExpiresAt' in web) {
    patch.todayStatusExpiresAt = normalizeTodayStatusExpiresAt(web.todayStatusExpiresAt)
  }
  if ('todayStatusBusy' in web) {
    patch.todayStatusBusy = normalizeTodayStatusBusy(web.todayStatusBusy)
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
  if ('publicFontOptionsEnabled' in web && typeof web.publicFontOptionsEnabled === 'boolean') {
    patch.publicFontOptionsEnabled = web.publicFontOptionsEnabled
  }
  if ('publicFontOptions' in web) {
    patch.publicFontOptions = publicPageFontOptionsFromApi(web.publicFontOptions)
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
  if ('smoothScrollEnabled' in web && typeof web.smoothScrollEnabled === 'boolean') {
    patch.smoothScrollEnabled = web.smoothScrollEnabled
  }
  if ('hideActivityMedia' in web && typeof web.hideActivityMedia === 'boolean') {
    patch.hideActivityMedia = web.hideActivityMedia
  }
  if ('mediaDisplayShowSource' in web && typeof web.mediaDisplayShowSource === 'boolean') {
    patch.mediaDisplayShowSource = web.mediaDisplayShowSource
  }
  if ('mediaDisplayShowCover' in web && typeof web.mediaDisplayShowCover === 'boolean') {
    patch.mediaDisplayShowCover = web.mediaDisplayShowCover
  }
  if ('mediaDisplayShowAppIcon' in web && typeof web.mediaDisplayShowAppIcon === 'boolean') {
    patch.mediaDisplayShowAppIcon = web.mediaDisplayShowAppIcon
  }
  if ('mediaDisplayShowNcmLink' in web && typeof web.mediaDisplayShowNcmLink === 'boolean') {
    patch.mediaDisplayShowNcmLink = web.mediaDisplayShowNcmLink
  }
  if ('mediaCoverMaxCount' in web) {
    const maxCount = Number(web.mediaCoverMaxCount)
    if (Number.isFinite(maxCount) && maxCount >= 0) {
      patch.mediaCoverMaxCount = Math.min(Math.max(maxCount, 0), 500)
    }
  }
  if ('statusCardEnabled' in web && typeof web.statusCardEnabled === 'boolean') {
    patch.statusCardEnabled = web.statusCardEnabled
  }
  if ('statusCardVariant' in web) {
    patch.statusCardVariant = normalizeStatusCardVariant(web.statusCardVariant)
  }
  if ('statusCardTag' in web) {
    patch.statusCardTag = normalizeStatusCardTag(web.statusCardTag)
  }
  if ('statusCardBackgroundKey' in web) {
    patch.statusCardBackgroundKey = normalizeStatusCardCoverKey(web.statusCardBackgroundKey) ?? ''
  }
  if ('statusCardBackgroundRev' in web) {
    patch.statusCardBackgroundRev = normalizeStatusCardCoverRev(web.statusCardBackgroundRev)
  }
  if ('statusCardCoverKey' in web) {
    patch.statusCardCoverKey = normalizeStatusCardCoverKey(web.statusCardCoverKey) ?? ''
  }
  if ('statusCardCoverRev' in web) {
    patch.statusCardCoverRev = normalizeStatusCardCoverRev(web.statusCardCoverRev)
  }
  for (const key of [
    'statusCardShowHeader',
    'statusCardShowAvatar',
    'statusCardShowName',
    'statusCardShowBio',
    'statusCardShowNote',
    'statusCardPreferGame',
    'statusCardShowInClassStatus',
  ] as const) {
    if (key in web && typeof web[key] === 'boolean') patch[key] = web[key]
  }
  if ('statusCardWidth' in web) {
    patch.statusCardWidth = normalizeStatusCardDimension(web.statusCardWidth, 520, 280, 1200)
  }
  if ('statusCardHeight' in web) {
    patch.statusCardHeight = normalizeStatusCardDimension(web.statusCardHeight, 310, 1, 720)
  }
  if ('statusCardRadius' in web) {
    patch.statusCardRadius = normalizeStatusCardDimension(web.statusCardRadius, 20, 0, 80)
  }
  if ('statusCardBg' in web) patch.statusCardBg = normalizeStatusCardHexColor(web.statusCardBg, '#FFFFFF')
  if ('statusCardSignatureBg' in web) patch.statusCardSignatureBg = normalizeStatusCardHexColor(web.statusCardSignatureBg, '#F4F0FF')
  if ('statusCardFg' in web) patch.statusCardFg = normalizeStatusCardHexColor(web.statusCardFg, '#111827')
  if ('statusCardMuted' in web) patch.statusCardMuted = normalizeStatusCardHexColor(web.statusCardMuted, '#6B7280')
  if ('statusCardAccent' in web) patch.statusCardAccent = normalizeStatusCardHexColor(web.statusCardAccent, '#22C55E')
  if ('statusCardBorder' in web) patch.statusCardBorder = normalizeStatusCardHexColor(web.statusCardBorder, '#E5E7EB')
  if ('hideInspirationOnHome' in web && typeof web.hideInspirationOnHome === 'boolean') {
    patch.hideInspirationOnHome = web.hideInspirationOnHome
  }
  if ('disableFrontendDeviceAnimation' in web && typeof web.disableFrontendDeviceAnimation === 'boolean') {
    patch.disableFrontendDeviceAnimation = web.disableFrontendDeviceAnimation
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

export function extractRuleToolsImportFromWebPayload(
  web: Record<string, unknown>,
): RuleToolsExportPayload | null {
  const hasAnyField = [
    'appMessageRules',
    'appMessageRulesShowProcessName',
    'appFilterMode',
    'appBlacklist',
    'appWhitelist',
    'appNameOnlyList',
    'captureReportedAppsEnabled',
    'captureReportedAppTitleLimit',
    'mediaPlaySourceBlocklist',
    'mediaPlaySourceRules',
  ].some((key) => key in web)
  if (!hasAnyField) return null

  const modeRaw = String(web.appFilterMode ?? 'blacklist').toLowerCase()
  const mediaPlaySourceRules = normalizeMediaPlaySourceRules(
    web.mediaPlaySourceRules,
    web.mediaPlaySourceBlocklist,
  )
  return {
    appMessageRules: normalizeRulesImport(web.appMessageRules),
    appMessageRulesShowProcessName:
      typeof web.appMessageRulesShowProcessName === 'boolean'
        ? web.appMessageRulesShowProcessName
        : true,
    appFilterMode: modeRaw === 'whitelist' ? 'whitelist' : 'blacklist',
    appBlacklist: normalizeStringListImport(web.appBlacklist),
    appWhitelist: normalizeStringListImport(web.appWhitelist),
    appNameOnlyList: normalizeStringListImport(web.appNameOnlyList),
    captureReportedAppsEnabled:
      typeof web.captureReportedAppsEnabled === 'boolean'
        ? web.captureReportedAppsEnabled
        : true,
    captureReportedAppTitleLimit: normalizeReportedAppTitleLimit(
      web.captureReportedAppTitleLimit,
    ),
    mediaPlaySourceRules,
    mediaPlaySourceBlocklist: mediaPlaySourceBlocklistFromRules(mediaPlaySourceRules),
  }
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
