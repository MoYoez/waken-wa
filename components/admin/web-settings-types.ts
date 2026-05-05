import type { ActivityUpdateMode } from '@/lib/activity-update-mode'
import type { UserNoteHitokotoEncode } from '@/lib/hitokoto'
import type { PublicPageFontOptionMode } from '@/lib/public-page-font'
import type { ScheduleCourse, SchedulePeriodTemplateItem } from '@/lib/schedule-courses'
import type { ScheduleDayGrid } from '@/lib/schedule-grid-by-weekday'
import type { SiteSettingsMigrationState } from '@/lib/site-settings-constants'
import type {
  ThemeBackgroundImageMode,
  ThemePaletteLiveScope,
  ThemePaletteMode,
} from '@/types/theme'

export type ThemeCustomSurfaceForm = {
  background: string
  bodyBackground: string
  animatedBg: string
  primary: string
  secondary: string
  accent: string
  online: string
  foreground: string
  card: string
  border: string
  muted: string
  mutedForeground: string
  homeCardOverlay: string
  homeCardOverlayDark: string
  homeCardInsetHighlight: string
  animatedBgTint1: string
  animatedBgTint2: string
  animatedBgTint3: string
  floatingOrbColor1: string
  floatingOrbColor2: string
  floatingOrbColor3: string
  radius: string
  hideFloatingOrbs: boolean
  transparentAnimatedBg: boolean
  backgroundImageMode: ThemeBackgroundImageMode
  backgroundImageUrl: string
  backgroundImagePool: string[]
  backgroundRandomApiUrl: string
  paletteMode: ThemePaletteMode
  paletteLiveEnabled: boolean
  paletteLiveScope: ThemePaletteLiveScope
  paletteSeedImageUrl: string
}

export type PublicPageFontOptionForm = {
  family: string
  label: string
  mode: PublicPageFontOptionMode
  url: string
}

export interface SiteConfig {
  /** Empty = use default admin accent tokens. */
  adminThemeColor: string
  /** Empty = use default admin surface tokens. */
  adminBackgroundColor: string
  pageTitle: string
  /** Empty = use built-in generated browser icon. */
  siteIconUrl: string
  userName: string
  userBio: string
  avatarUrl: string
  avatarFetchByServerEnabled: boolean
  /** Empty = use theme --online; otherwise #RRGGBB */
  profileOnlineAccentColor: string
  /** Online status dot breathing animation (animate-pulse) */
  profileOnlinePulseEnabled: boolean
  userNote: string
  userNoteHitokotoEnabled: boolean
  userNoteTypewriterEnabled: boolean
  userNoteSignatureFontEnabled: boolean
  userNoteSignatureFontFamily: string
  pageLoadingEnabled: boolean
  searchEngineIndexingEnabled: boolean
  userNoteHitokotoCategories: string[]
  userNoteHitokotoEncode: UserNoteHitokotoEncode
  userNoteHitokotoFallbackToNote: boolean
  themePreset: string
  themeCustomSurface: ThemeCustomSurfaceForm
  publicFontOptionsEnabled: boolean
  publicFontOptions: PublicPageFontOptionForm[]
  customCss: string
  mcpThemeToolsEnabled: boolean
  openApiDocsEnabled: boolean
  aiToolMode: 'skills' | 'mcp'
  historyWindowMinutes: number
  processStaleSeconds: number
  pageLockEnabled: boolean
  pageLockPassword: string
  hcaptchaEnabled: boolean
  hcaptchaSiteKey: string
  hcaptchaSecretKey: string
  currentlyText: string
  earlierText: string
  adminText: string
  autoAcceptNewDevices: boolean
  /** When true, PATCH sends inspirationAllowedDeviceHashes array; when false, sends null (no restriction). */
  inspirationDeviceRestrictionEnabled: boolean
  inspirationAllowedDeviceHashes: string[]
  scheduleSlotMinutes: number
  schedulePeriodTemplate: SchedulePeriodTemplateItem[]
  scheduleGridByWeekday: ScheduleDayGrid[]
  scheduleCourses: ScheduleCourse[]
  scheduleIcs: string
  scheduleInClassOnHome: boolean
  scheduleHomeShowLocation: boolean
  scheduleHomeShowTeacher: boolean
  scheduleHomeShowNextUpcoming: boolean
  scheduleHomeAfterClassesLabel: string
  globalMouseTiltEnabled: boolean
  globalMouseTiltGyroEnabled: boolean
  /** When true, the public site uses Lenis smooth scrolling globally. */
  smoothScrollEnabled: boolean
  hideActivityMedia: boolean
  /** When true, show media source in hover card. */
  mediaDisplayShowSource: boolean
  /** When true, show media cover image in hover card. */
  mediaDisplayShowCover: boolean
  /** Max number of cover images to keep per device (0 = unlimited, recommended: 50). */
  mediaCoverMaxCount: number
  /** When true, hide the inspiration section from the home page. */
  hideInspirationOnHome: boolean
  /**
   * When true, POST /api/activity rejects reports whose process_name matches lock-screen / sleep-like reporters
   * such as LockApp or macOS loginwindow.
   * English UI help only; behavior is server-side.
   */
  activityRejectLockappSleep: boolean
  /** Display timezone, defaults to Asia/Shanghai. */
  displayTimezone: string
  /** When true, all absolute times and schedule day math follow displayTimezone. */
  forceDisplayTimezone: boolean
  /** Public activity update mode. */
  activityUpdateMode: ActivityUpdateMode
  /** Enable Redis cache outside forced runtime environments. */
  useNoSqlAsCacheRedis: boolean
  /** Redis activity-feed cache TTL seconds. */
  redisCacheTtlSeconds: number
  /** Whether Steam status integration is enabled. */
  steamEnabled: boolean
  /** Steam 64-bit ID */
  steamId: string
  /** Steam Web API key (submit non-empty to replace stored key) */
  steamApiKey: string
}

export type PatchSiteConfig = <K extends keyof SiteConfig>(key: K, value: SiteConfig[K]) => void

export type SkillsAiAuthorizationItem = {
  aiClientId: string
  pendingCodeCount: number
  approvedCodeCount: number
  activeTokenCount: number
  lastApprovedAt: string | null
  lastExchangedAt: string | null
}

export type SkillsEditableConfig = {
  enabled: boolean
  authMode: 'oauth' | 'apikey' | ''
  oauthTokenTtlMinutes: number
}

export type SiteSettingsMigrationInfo = {
  siteConfigId: number
  migrationState: SiteSettingsMigrationState
  migratedAt: string | null
  legacyDataClearedAt: string | null
  legacyDataPresent: boolean
  stateInferred: boolean
  coveredCategories: string[]
  canMigrate: boolean
  canClearLegacyData: boolean
  heavyEditingLocked: boolean
}
