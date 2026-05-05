import { DEFAULT_PAGE_TITLE } from '@/lib/default-page-title'
import {
  SITE_CONFIG_HISTORY_WINDOW_DEFAULT_MINUTES,
  SITE_CONFIG_PROCESS_STALE_DEFAULT_SECONDS,
  SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_DEFAULT,
  SITE_CONFIG_SCHEDULE_SLOT_DEFAULT_MINUTES,
} from '@/lib/site-config-constants'

export const SITE_SETTINGS_MIGRATION_STATES = [
  'legacy',
  'migrated',
  'legacy_cleared',
] as const

export type SiteSettingsMigrationState =
  (typeof SITE_SETTINGS_MIGRATION_STATES)[number]

export const SITE_SETTINGS_COVERED_CATEGORIES = [
  'theme',
  'schedule',
  'rules',
] as const

export type SiteSettingsCoveredCategory =
  (typeof SITE_SETTINGS_COVERED_CATEGORIES)[number]

export const SITE_SETTINGS_THEME_CATEGORY_KEYS = [
  'themePreset',
  'themeCustomSurface',
  'publicFontOptionsEnabled',
  'publicFontOptions',
  'customCss',
] as const

export const SITE_SETTINGS_THEME_HEAVY_KEYS = [
  'themeCustomSurface',
  'publicFontOptions',
  'customCss',
] as const

export const SITE_SETTINGS_SCHEDULE_CATEGORY_KEYS = [
  'scheduleSlotMinutes',
  'schedulePeriodTemplate',
  'scheduleGridByWeekday',
  'scheduleCourses',
  'scheduleIcs',
  'scheduleInClassOnHome',
  'scheduleHomeShowLocation',
  'scheduleHomeShowTeacher',
  'scheduleHomeShowNextUpcoming',
  'scheduleHomeAfterClassesLabel',
] as const

export const SITE_SETTINGS_SCHEDULE_HEAVY_KEYS = [
  'schedulePeriodTemplate',
  'scheduleGridByWeekday',
  'scheduleCourses',
  'scheduleIcs',
] as const

export const SITE_SETTINGS_RULES_KEYS = [
  'appMessageRules',
  'appMessageRulesShowProcessName',
  'appFilterMode',
  'appBlacklist',
  'appWhitelist',
  'appNameOnlyList',
  'captureReportedAppsEnabled',
  'mediaPlaySourceBlocklist',
] as const

export const SITE_SETTINGS_CORE_HEAVY_KEYS = [
  'userNoteHitokotoCategories',
  'inspirationAllowedDeviceHashes',
] as const

export const SITE_SETTINGS_MIGRATED_CORE_KEYS = [
  'mediaDisplayShowSource',
  'mediaDisplayShowCover',
  'mediaCoverMaxCount',
] as const

export const SITE_SETTINGS_HEAVY_KEYS = [
  ...SITE_SETTINGS_THEME_HEAVY_KEYS,
  ...SITE_SETTINGS_SCHEDULE_HEAVY_KEYS,
  ...SITE_SETTINGS_RULES_KEYS,
  ...SITE_SETTINGS_CORE_HEAVY_KEYS,
] as const

export const SITE_SETTINGS_COMPAT_WRITE_BLOCKED_KEYS = [
  ...SITE_SETTINGS_THEME_CATEGORY_KEYS,
  ...SITE_SETTINGS_SCHEDULE_CATEGORY_KEYS,
  ...SITE_SETTINGS_RULES_KEYS,
] as const

export const SITE_SETTINGS_CLEAR_LEGACY_VALUES: Record<string, unknown> = {
  themePreset: 'basic',
  themeCustomSurface: null,
  publicFontOptionsEnabled: false,
  publicFontOptions: null,
  customCss: null,
  appMessageRules: null,
  appMessageRulesShowProcessName: true,
  appFilterMode: 'blacklist',
  appBlacklist: null,
  appWhitelist: null,
  appNameOnlyList: null,
  captureReportedAppsEnabled: true,
  mediaPlaySourceBlocklist: null,
  scheduleSlotMinutes: SITE_CONFIG_SCHEDULE_SLOT_DEFAULT_MINUTES,
  schedulePeriodTemplate: null,
  scheduleGridByWeekday: null,
  scheduleCourses: null,
  scheduleIcs: null,
  scheduleInClassOnHome: false,
  scheduleHomeShowLocation: false,
  scheduleHomeShowTeacher: false,
  scheduleHomeShowNextUpcoming: false,
  scheduleHomeAfterClassesLabel: SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_DEFAULT,
}

export const SITE_SETTINGS_CLEAR_LEGACY_SITE_CONFIG_VALUES: Record<string, unknown> = {
  adminThemeColor: null,
  adminBackgroundColor: null,
  pageTitle: DEFAULT_PAGE_TITLE,
  siteIconUrl: null,
  userName: '',
  userBio: '',
  avatarUrl: '',
  avatarFetchByServerEnabled: false,
  profileOnlineAccentColor: null,
  profileOnlinePulseEnabled: null,
  userNote: '',
  userNoteHitokotoEnabled: false,
  userNoteTypewriterEnabled: false,
  userNoteSignatureFontEnabled: false,
  userNoteSignatureFontFamily: null,
  pageLoadingEnabled: true,
  searchEngineIndexingEnabled: true,
  userNoteHitokotoCategories: null,
  userNoteHitokotoEncode: 'json',
  userNoteHitokotoFallbackToNote: false,
  themePreset: 'basic',
  themeCustomSurface: null,
  publicFontOptionsEnabled: false,
  publicFontOptions: null,
  customCss: null,
  mcpThemeToolsEnabled: false,
  skillsDebugEnabled: false,
  openApiDocsEnabled: true,
  skillsAuthMode: null,
  skillsOauthExpiresAt: null,
  skillsOauthTokenTtlMinutes: 60,
  aiToolMode: 'skills',
  historyWindowMinutes: SITE_CONFIG_HISTORY_WINDOW_DEFAULT_MINUTES,
  appMessageRules: null,
  appMessageRulesShowProcessName: true,
  appBlacklist: null,
  appWhitelist: null,
  appFilterMode: 'blacklist',
  appNameOnlyList: null,
  captureReportedAppsEnabled: true,
  mediaPlaySourceBlocklist: null,
  processStaleSeconds: SITE_CONFIG_PROCESS_STALE_DEFAULT_SECONDS,
  pageLockEnabled: false,
  pageLockPasswordHash: null,
  currentlyText: '当前状态',
  earlierText: '最近的随想录',
  adminText: 'admin',
  autoAcceptNewDevices: false,
  inspirationAllowedDeviceHashes: null,
  scheduleSlotMinutes: SITE_CONFIG_SCHEDULE_SLOT_DEFAULT_MINUTES,
  schedulePeriodTemplate: null,
  scheduleGridByWeekday: null,
  scheduleCourses: null,
  scheduleIcs: null,
  scheduleInClassOnHome: false,
  scheduleHomeShowLocation: false,
  scheduleHomeShowTeacher: false,
  scheduleHomeShowNextUpcoming: false,
  scheduleHomeAfterClassesLabel: SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_DEFAULT,
  globalMouseTiltEnabled: false,
  globalMouseTiltGyroEnabled: false,
  smoothScrollEnabled: false,
  hideActivityMedia: false,
  hideInspirationOnHome: false,
  hcaptchaEnabled: false,
  hcaptchaSiteKey: null,
  hcaptchaSecretKey: null,
  displayTimezone: 'Asia/Shanghai',
  forceDisplayTimezone: false,
  activityUpdateMode: 'sse',
  steamEnabled: false,
  steamId: null,
  steamApiKey: null,
  useNoSqlAsCacheRedis: true,
  redisCacheTtlSeconds: 3600,
  activityRejectLockappSleep: false,
}

export function isSiteSettingsMigrationState(
  value: unknown,
): value is SiteSettingsMigrationState {
  return (
    typeof value === 'string' &&
    (SITE_SETTINGS_MIGRATION_STATES as readonly string[]).includes(value)
  )
}

export function pickRecordKeys<T extends Record<string, unknown>>(
  source: T,
  keys: readonly string[],
): Record<string, unknown> {
  const next: Record<string, unknown> = {}
  for (const key of keys) {
    if (key in source) {
      next[key] = source[key]
    }
  }
  return next
}

export function omitRecordKeys<T extends Record<string, unknown>>(
  source: T,
  keys: readonly string[],
): Record<string, unknown> {
  const denied = new Set(keys)
  const next: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(source)) {
    if (denied.has(key)) continue
    next[key] = value
  }
  return next
}

export function hasAnyRecordKey(
  source: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  return keys.some((key) => key in source)
}
