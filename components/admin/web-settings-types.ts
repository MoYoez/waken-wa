import type { ActivityUpdateMode } from '@/lib/activity-update-mode'
import type { UserNoteHitokotoEncode } from '@/lib/hitokoto'
import type { ScheduleCourse, SchedulePeriodTemplateItem } from '@/lib/schedule-courses'
import type { ScheduleDayGrid } from '@/lib/schedule-grid-by-weekday'
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

export interface SiteConfig {
  pageTitle: string
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
  pageLoadingEnabled: boolean
  searchEngineIndexingEnabled: boolean
  userNoteHitokotoCategories: string[]
  userNoteHitokotoEncode: UserNoteHitokotoEncode
  userNoteHitokotoFallbackToNote: boolean
  themePreset: string
  themeCustomSurface: ThemeCustomSurfaceForm
  customCss: string
  mcpThemeToolsEnabled: boolean
  openApiDocsEnabled: boolean
  aiToolMode: 'skills' | 'mcp'
  historyWindowMinutes: number
  processStaleSeconds: number
  appMessageRules: Array<{ match: string; text: string }>
  appMessageRulesShowProcessName: boolean
  appFilterMode: 'blacklist' | 'whitelist'
  appBlacklist: string[]
  appWhitelist: string[]
  appNameOnlyList: string[]
  /** When false, stop capturing app history (keeps existing records). */
  captureReportedAppsEnabled: boolean
  /** Lowercased play_source values that should hide metadata.media. */
  mediaPlaySourceBlocklist: string[]
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
  hideActivityMedia: boolean
  /**
   * When true, POST /api/activity rejects reports whose process_name is the LockApp reporter (basename lockapp / lockapp.exe).
   * English UI help only; behavior is server-side.
   */
  activityRejectLockappSleep: boolean
  /** 显示时区，默认 Asia/Shanghai */
  displayTimezone: string
  /** 活动状态更新模式 */
  activityUpdateMode: ActivityUpdateMode
  /** Enable Redis cache outside forced runtime environments. */
  useNoSqlAsCacheRedis: boolean
  /** Redis activity-feed cache TTL seconds. */
  redisCacheTtlSeconds: number
  /** Steam 状态是否启用 */
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
