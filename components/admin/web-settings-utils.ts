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

type WebPayloadBooleanPatchKey = Extract<
  {
    [K in keyof SiteConfig]: SiteConfig[K] extends boolean ? K : never
  }[keyof SiteConfig],
  string
>

type StatusCardColorPatchKey =
  | 'statusCardBg'
  | 'statusCardSignatureBg'
  | 'statusCardFg'
  | 'statusCardMuted'
  | 'statusCardAccent'
  | 'statusCardBorder'

function setBooleanPatchField(
  patch: Partial<SiteConfig>,
  key: WebPayloadBooleanPatchKey,
  value: unknown,
): void {
  if (typeof value === 'boolean') {
    patch[key] = value
  }
}

function resolveImportedScheduleSlot(value: unknown): number | null {
  const slot = Number(value)
  return isAllowedSlotMinutes(slot) ? slot : null
}

function resolveStatusCardColorFallback(key: StatusCardColorPatchKey): string {
  switch (key) {
    case 'statusCardBg':
      return '#FFFFFF'
    case 'statusCardSignatureBg':
      return '#F4F0FF'
    case 'statusCardFg':
      return '#111827'
    case 'statusCardMuted':
      return '#6B7280'
    case 'statusCardAccent':
      return '#22C55E'
    case 'statusCardBorder':
      return '#E5E7EB'
  }
}

function setStatusCardColorPatchField(
  patch: Partial<SiteConfig>,
  key: StatusCardColorPatchKey,
  value: unknown,
): void {
  patch[key] = normalizeStatusCardHexColor(value, resolveStatusCardColorFallback(key))
}

/** Maps export `web` object into form fields (same shape as GET /api/admin/settings). */
export function webPayloadToFormPatch(web: Record<string, unknown>): Partial<SiteConfig> {
  const patch: Partial<SiteConfig> = {}
  const importedAvatarUrl = typeof web.avatarUrl === 'string' ? web.avatarUrl.trim() : undefined
  const scheduleImportSlot =
    resolveImportedScheduleSlot(web.scheduleSlotMinutes) ??
    SITE_CONFIG_SCHEDULE_SLOT_DEFAULT_MINUTES

  for (const [key, value] of Object.entries(web)) {
    switch (key) {
      case 'adminThemeColor':
        patch.adminThemeColor =
          typeof value === 'string' ? (normalizeAdminThemeColor(value) ?? '') : ''
        break
      case 'adminBackgroundColor':
        patch.adminBackgroundColor =
          typeof value === 'string' ? (normalizeAdminThemeColor(value) ?? '') : ''
        break
      case 'pageTitle':
        if (typeof value === 'string') {
          const title = value.trim()
          patch.pageTitle = title ? title.slice(0, PAGE_TITLE_MAX_LEN) : DEFAULT_PAGE_TITLE
        }
        break
      case 'siteIconUrl':
        patch.siteIconUrl =
          typeof value === 'string' ? (normalizeSiteIconUrl(value) ?? '') : ''
        break
      case 'userName':
        if (typeof value === 'string') patch.userName = value.trim()
        break
      case 'userBio':
        if (typeof value === 'string') patch.userBio = value.trim()
        break
      case 'avatarUrl':
        if (typeof value === 'string') patch.avatarUrl = value.trim()
        break
      case 'avatarFetchByServerEnabled':
        if (typeof value === 'boolean') {
          patch.avatarFetchByServerEnabled = isRemoteAvatarUrl(importedAvatarUrl) && value
        }
        break
      case 'profileOnlineAccentColor':
        if (value === null || value === '') {
          patch.profileOnlineAccentColor = ''
        } else if (typeof value === 'string') {
          patch.profileOnlineAccentColor = normalizeProfileOnlineAccentColor(value) ?? ''
        }
        break
      case 'todayStatusEmoji':
        patch.todayStatusEmoji = normalizeTodayStatusEmoji(value)
        break
      case 'todayStatusText':
        patch.todayStatusText = normalizeTodayStatusText(value)
        break
      case 'todayStatusExpiresAt':
        patch.todayStatusExpiresAt = normalizeTodayStatusExpiresAt(value)
        break
      case 'todayStatusBusy':
        patch.todayStatusBusy = normalizeTodayStatusBusy(value)
        break
      case 'userNote':
        if (typeof value === 'string') patch.userNote = value.trim()
        break
      case 'userNoteSignatureFontFamily':
        if (typeof value === 'string') {
          patch.userNoteSignatureFontFamily = value.trim().slice(0, 160)
        }
        break
      case 'userNoteHitokotoCategories':
        patch.userNoteHitokotoCategories = normalizeHitokotoCategories(value)
        break
      case 'userNoteHitokotoEncode':
        patch.userNoteHitokotoEncode = normalizeHitokotoEncode(value)
        break
      case 'themePreset':
        if (typeof value === 'string') patch.themePreset = value.trim() || 'basic'
        break
      case 'themeCustomSurface':
        patch.themeCustomSurface = themeCustomSurfaceFromApi(value)
        break
      case 'publicFontOptions':
        patch.publicFontOptions = publicPageFontOptionsFromApi(value)
        break
      case 'customCss':
        if (typeof value === 'string') patch.customCss = value
        break
      case 'historyWindowMinutes': {
        const minutes = Number(value)
        if (Number.isFinite(minutes)) {
          patch.historyWindowMinutes = clampSiteConfigHistoryWindowMinutes(minutes)
        }
        break
      }
      case 'processStaleSeconds': {
        const seconds = Number(value)
        if (Number.isFinite(seconds)) {
          patch.processStaleSeconds = clampSiteConfigProcessStaleSeconds(seconds)
        }
        break
      }
      case 'currentlyText':
        if (typeof value === 'string') patch.currentlyText = value.trim()
        break
      case 'earlierText':
        if (typeof value === 'string') patch.earlierText = value.trim()
        break
      case 'adminText':
        if (typeof value === 'string') patch.adminText = value.trim() || 'admin'
        break
      case 'inspirationAllowedDeviceHashes':
        if (value === null) {
          patch.inspirationDeviceRestrictionEnabled = false
          patch.inspirationAllowedDeviceHashes = []
        } else if (Array.isArray(value)) {
          patch.inspirationDeviceRestrictionEnabled = true
          patch.inspirationAllowedDeviceHashes = value
            .map((item) => String(item ?? '').trim())
            .filter((item) => item.length > 0)
        }
        break
      case 'scheduleSlotMinutes': {
        const slot = resolveImportedScheduleSlot(value)
        if (slot !== null) patch.scheduleSlotMinutes = slot
        break
      }
      case 'scheduleGridByWeekday':
        if (Array.isArray(value)) {
          patch.scheduleGridByWeekday = resolveScheduleGridByWeekday(value, scheduleImportSlot)
        }
        break
      case 'schedulePeriodTemplate':
        patch.schedulePeriodTemplate = resolveSchedulePeriodTemplate(value)
        break
      case 'scheduleCourses':
        if (Array.isArray(value)) patch.scheduleCourses = value as ScheduleCourse[]
        break
      case 'scheduleIcs':
        if (value === null) {
          patch.scheduleIcs = ''
        } else if (typeof value === 'string') {
          patch.scheduleIcs = value
        }
        break
      case 'scheduleHomeAfterClassesLabel':
        if (typeof value === 'string') {
          const label = value.trim()
          patch.scheduleHomeAfterClassesLabel = (
            label.length > 0 ? label : SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_DEFAULT
          ).slice(0, SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_MAX_LEN)
        }
        break
      case 'mediaCoverMaxCount': {
        const maxCount = Number(value)
        if (Number.isFinite(maxCount) && maxCount >= 0) {
          patch.mediaCoverMaxCount = Math.min(Math.max(maxCount, 0), 500)
        }
        break
      }
      case 'statusCardVariant':
        patch.statusCardVariant = normalizeStatusCardVariant(value)
        break
      case 'statusCardTag':
        patch.statusCardTag = normalizeStatusCardTag(value)
        break
      case 'statusCardBackgroundKey':
        patch.statusCardBackgroundKey = normalizeStatusCardCoverKey(value) ?? ''
        break
      case 'statusCardBackgroundRev':
        patch.statusCardBackgroundRev = normalizeStatusCardCoverRev(value)
        break
      case 'statusCardCoverKey':
        patch.statusCardCoverKey = normalizeStatusCardCoverKey(value) ?? ''
        break
      case 'statusCardCoverRev':
        patch.statusCardCoverRev = normalizeStatusCardCoverRev(value)
        break
      case 'statusCardWidth':
        patch.statusCardWidth = normalizeStatusCardDimension(value, 520, 280, 1200)
        break
      case 'statusCardHeight':
        patch.statusCardHeight = normalizeStatusCardDimension(value, 310, 1, 720)
        break
      case 'statusCardRadius':
        patch.statusCardRadius = normalizeStatusCardDimension(value, 20, 0, 80)
        break
      case 'statusCardBg':
      case 'statusCardSignatureBg':
      case 'statusCardFg':
      case 'statusCardMuted':
      case 'statusCardAccent':
      case 'statusCardBorder':
        setStatusCardColorPatchField(patch, key, value)
        break
      case 'redisCacheTtlSeconds': {
        const ttl = Number(value)
        if (Number.isFinite(ttl)) {
          patch.redisCacheTtlSeconds = Math.min(
            REDIS_ACTIVITY_FEED_CACHE_TTL_MAX_SECONDS,
            Math.max(1, Math.round(ttl)),
          )
        }
        break
      }
      case 'profileOnlinePulseEnabled':
      case 'userNoteHitokotoEnabled':
      case 'userNoteTypewriterEnabled':
      case 'userNoteSignatureFontEnabled':
      case 'userNoteHitokotoFallbackToNote':
      case 'publicFontOptionsEnabled':
      case 'pageLockEnabled':
      case 'autoAcceptNewDevices':
      case 'scheduleInClassOnHome':
      case 'scheduleHomeShowLocation':
      case 'scheduleHomeShowTeacher':
      case 'scheduleHomeShowNextUpcoming':
      case 'globalMouseTiltEnabled':
      case 'globalMouseTiltGyroEnabled':
      case 'smoothScrollEnabled':
      case 'hideActivityMedia':
      case 'mediaDisplayShowSource':
      case 'mediaDisplayShowCover':
      case 'mediaDisplayShowAppIcon':
      case 'mediaDisplayShowNcmLink':
      case 'statusCardEnabled':
      case 'statusCardShowHeader':
      case 'statusCardShowAvatar':
      case 'statusCardShowName':
      case 'statusCardShowBio':
      case 'statusCardShowNote':
      case 'statusCardPreferGame':
      case 'statusCardShowInClassStatus':
      case 'hideInspirationOnHome':
      case 'disableFrontendDeviceAnimation':
      case 'activityRejectLockappSleep':
      case 'useNoSqlAsCacheRedis':
        setBooleanPatchField(patch, key, value)
        break
      default:
        break
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
