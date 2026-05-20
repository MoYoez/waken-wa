import { atom } from 'jotai'

import {
  emptyPublicPageFontOptionsForm,
  emptyThemeCustomSurfaceForm,
} from '@/components/admin/web-settings-utils'
import {
  REDIS_ACTIVITY_FEED_CACHE_TTL_DEFAULT_SECONDS,
} from '@/constants/activity-api'
import {
  SITE_CONFIG_HISTORY_WINDOW_DEFAULT_MINUTES,
  SITE_CONFIG_PROCESS_STALE_DEFAULT_SECONDS,
  SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_DEFAULT,
  SITE_CONFIG_SCHEDULE_SLOT_DEFAULT_MINUTES,
} from '@/constants/site-config'
import {
  DEFAULT_ACTIVITY_UPDATE_MODE,
} from '@/lib/activity-update-mode'
import { DEFAULT_PAGE_TITLE } from '@/lib/default-page-title'
import { resolveSchedulePeriodTemplate } from '@/lib/schedule-courses'
import { resolveScheduleGridByWeekday } from '@/lib/schedule-grid-by-weekday'
import { DEFAULT_TIMEZONE } from '@/lib/timezone'
import type {
  SiteConfig,
  SiteSettingsMigrationInfo,
  SkillsAiAuthorizationItem,
  SkillsEditableConfig,
} from '@/types/web-settings'

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
  todayStatusEmoji: '',
  todayStatusText: '',
  todayStatusExpiresAt: '',
  todayStatusBusy: false,
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
  mediaDisplayShowSource: false,
  mediaDisplayShowCover: false,
  mediaDisplayShowAppIcon: false,
  mediaDisplayShowNcmLink: false,
  mediaCoverMaxCount: 50,
  hideInspirationOnHome: false,
  disableFrontendDeviceAnimation: false,
  activityRejectLockappSleep: false,
  displayTimezone: DEFAULT_TIMEZONE,
  forceDisplayTimezone: false,
  activityUpdateMode: DEFAULT_ACTIVITY_UPDATE_MODE,
  useNoSqlAsCacheRedis: true,
  redisCacheTtlSeconds: REDIS_ACTIVITY_FEED_CACHE_TTL_DEFAULT_SECONDS,
  steamEnabled: false,
  steamId: '',
  steamApiKey: '',
  statusCardEnabled: false,
  statusCardVariant: 'aurora',
  statusCardTag: '',
  statusCardBackgroundKey: '',
  statusCardBackgroundRev: '',
  statusCardCoverKey: '',
  statusCardCoverRev: '',
  statusCardShowHeader: true,
  statusCardShowAvatar: true,
  statusCardShowName: true,
  statusCardShowBio: true,
  statusCardShowNote: false,
  statusCardPreferGame: false,
  statusCardShowInClassStatus: false,
  statusCardWidth: 520,
  statusCardHeight: 310,
  statusCardRadius: 20,
  statusCardBg: '#FFFFFF',
  statusCardSignatureBg: '#F4F0FF',
  statusCardFg: '#111827',
  statusCardMuted: '#6B7280',
  statusCardAccent: '#22C55E',
  statusCardBorder: '#E5E7EB',
}

export const webSettingsLoadingAtom = atom(true)
export const webSettingsSavingAtom = atom(false)
export const webSettingsFormAtom = atom<SiteConfig>(WEB_SETTINGS_INITIAL_FORM)
export const webSettingsBaselineFormAtom = atom<SiteConfig | null>(null)
export const webSettingsPublicOriginAtom = atom('')
export const webSettingsImportConfigDialogOpenAtom = atom(false)
export const webSettingsImportConfigInputAtom = atom('')
export const webSettingsCropSourceUrlAtom = atom<string | null>(null)
export const webSettingsCropDialogOpenAtom = atom(false)
export const webSettingsCropTargetAtom = atom<'avatar' | 'siteIcon'>('avatar')
export const webSettingsInspirationDevicesAtom = atom<
  Array<{ id: number; displayName: string; generatedHashKey: string; status: string }>
>([])
export const webSettingsRedisCacheServerlessForcedAtom = atom(false)
export const webSettingsMigrationAtom = atom<SiteSettingsMigrationInfo | null>(null)

export const webSettingsSkillsSavingAtom = atom(false)
export const webSettingsSkillsEnabledAtom = atom(false)
export const webSettingsSkillsAuthModeAtom = atom<'oauth' | 'apikey' | ''>('')
export const webSettingsSkillsApiKeyConfiguredAtom = atom(false)
export const webSettingsSkillsOauthConfiguredAtom = atom(false)
export const webSettingsSkillsOauthTokenTtlMinutesAtom = atom<number | string>(60)
export const webSettingsSkillsAiAuthorizationsAtom = atom<SkillsAiAuthorizationItem[]>([])
export const webSettingsSkillsRevokingAiClientIdAtom = atom('')
export const webSettingsSkillsGeneratedApiKeyAtom = atom('')
export const webSettingsLegacyMcpConfiguredAtom = atom(false)
export const webSettingsLegacyMcpGeneratedApiKeyAtom = atom('')
export const webSettingsBaselineSkillsConfigAtom = atom<SkillsEditableConfig | null>(null)
