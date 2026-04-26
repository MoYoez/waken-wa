import { atom } from 'jotai'

import type {
  SiteConfig,
  SkillsAiAuthorizationItem,
  SkillsEditableConfig,
} from '@/components/admin/web-settings-types'
import {
  emptyPublicPageFontOptionsForm,
  emptyThemeCustomSurfaceForm,
} from '@/components/admin/web-settings-utils'
import {
  REDIS_ACTIVITY_FEED_CACHE_TTL_DEFAULT_SECONDS,
} from '@/lib/activity-api-constants'
import {
  DEFAULT_ACTIVITY_UPDATE_MODE,
} from '@/lib/activity-update-mode'
import { DEFAULT_PAGE_TITLE } from '@/lib/default-page-title'
import { resolveSchedulePeriodTemplate } from '@/lib/schedule-courses'
import { resolveScheduleGridByWeekday } from '@/lib/schedule-grid-by-weekday'
import {
  SITE_CONFIG_HISTORY_WINDOW_DEFAULT_MINUTES,
  SITE_CONFIG_PROCESS_STALE_DEFAULT_SECONDS,
  SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_DEFAULT,
  SITE_CONFIG_SCHEDULE_SLOT_DEFAULT_MINUTES,
} from '@/lib/site-config-constants'
import { DEFAULT_TIMEZONE } from '@/lib/timezone'

export const WEB_SETTINGS_INITIAL_FORM: SiteConfig = {
  adminThemeColor: '',
  adminBackgroundColor: '',
  pageTitle: DEFAULT_PAGE_TITLE,
  siteIconUrl: '',
  userName: '',
  userBio: '',
  avatarUrl: '',
  avatarFetchByServerEnabled: false,
  profileOnlineAccentColor: '',
  profileOnlinePulseEnabled: true,
  userNote: '',
  userNoteHitokotoEnabled: false,
  userNoteTypewriterEnabled: false,
  userNoteSignatureFontEnabled: false,
  userNoteSignatureFontFamily: '',
  pageLoadingEnabled: true,
  searchEngineIndexingEnabled: true,
  userNoteHitokotoCategories: [],
  userNoteHitokotoEncode: 'json',
  userNoteHitokotoFallbackToNote: false,
  themePreset: 'basic',
  themeCustomSurface: emptyThemeCustomSurfaceForm(),
  publicFontOptionsEnabled: false,
  publicFontOptions: emptyPublicPageFontOptionsForm(),
  customCss: '',
  mcpThemeToolsEnabled: false,
  openApiDocsEnabled: true,
  aiToolMode: 'skills',
  historyWindowMinutes: SITE_CONFIG_HISTORY_WINDOW_DEFAULT_MINUTES,
  processStaleSeconds: SITE_CONFIG_PROCESS_STALE_DEFAULT_SECONDS,
  appMessageRules: [],
  appMessageRulesShowProcessName: true,
  appFilterMode: 'blacklist',
  appBlacklist: [],
  appWhitelist: [],
  appNameOnlyList: [],
  captureReportedAppsEnabled: true,
  mediaPlaySourceBlocklist: [],
  pageLockEnabled: false,
  pageLockPassword: '',
  hcaptchaEnabled: false,
  hcaptchaSiteKey: '',
  hcaptchaSecretKey: '',
  currentlyText: '',
  earlierText: '',
  adminText: 'admin',
  autoAcceptNewDevices: false,
  inspirationDeviceRestrictionEnabled: false,
  inspirationAllowedDeviceHashes: [],
  scheduleSlotMinutes: SITE_CONFIG_SCHEDULE_SLOT_DEFAULT_MINUTES,
  schedulePeriodTemplate: resolveSchedulePeriodTemplate(null),
  scheduleGridByWeekday: resolveScheduleGridByWeekday(
    null,
    SITE_CONFIG_SCHEDULE_SLOT_DEFAULT_MINUTES,
  ),
  scheduleCourses: [],
  scheduleIcs: '',
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
  activityRejectLockappSleep: false,
  displayTimezone: DEFAULT_TIMEZONE,
  forceDisplayTimezone: false,
  activityUpdateMode: DEFAULT_ACTIVITY_UPDATE_MODE,
  useNoSqlAsCacheRedis: true,
  redisCacheTtlSeconds: REDIS_ACTIVITY_FEED_CACHE_TTL_DEFAULT_SECONDS,
  steamEnabled: false,
  steamId: '',
  steamApiKey: '',
}

export const webSettingsLoadingAtom = atom(true)
export const webSettingsSavingAtom = atom(false)
export const webSettingsFormAtom = atom<SiteConfig>(WEB_SETTINGS_INITIAL_FORM)
export const webSettingsBaselineFormAtom = atom<SiteConfig | null>(null)
export const webSettingsPublicOriginAtom = atom('')
export const webSettingsImportConfigDialogOpenAtom = atom(false)
export const webSettingsImportConfigInputAtom = atom('')
export const webSettingsHistoryAppsAtom = atom<string[]>([])
export const webSettingsHistoryPlaySourcesAtom = atom<string[]>([])
export const webSettingsCropSourceUrlAtom = atom<string | null>(null)
export const webSettingsCropDialogOpenAtom = atom(false)
export const webSettingsInspirationDevicesAtom = atom<
  Array<{ id: number; displayName: string; generatedHashKey: string; status: string }>
>([])
export const webSettingsRedisCacheServerlessForcedAtom = atom(false)

export const webSettingsSkillsSavingAtom = atom(false)
export const webSettingsSkillsEnabledAtom = atom(false)
export const webSettingsSkillsAuthModeAtom = atom<'oauth' | 'apikey' | ''>('')
export const webSettingsSkillsApiKeyConfiguredAtom = atom(false)
export const webSettingsSkillsOauthConfiguredAtom = atom(false)
export const webSettingsSkillsOauthTokenTtlMinutesAtom = atom(60)
export const webSettingsSkillsAiAuthorizationsAtom = atom<SkillsAiAuthorizationItem[]>([])
export const webSettingsSkillsRevokingAiClientIdAtom = atom('')
export const webSettingsSkillsGeneratedApiKeyAtom = atom('')
export const webSettingsLegacyMcpConfiguredAtom = atom(false)
export const webSettingsLegacyMcpGeneratedApiKeyAtom = atom('')
export const webSettingsBaselineSkillsConfigAtom = atom<SkillsEditableConfig | null>(null)
