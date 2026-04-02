'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { ImageCropDialog } from '@/components/admin/image-crop-dialog'
import { UnsavedChangesBar } from '@/components/admin/unsaved-changes-bar'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  REDIS_ACTIVITY_FEED_CACHE_TTL_DEFAULT_SECONDS,
  REDIS_ACTIVITY_FEED_CACHE_TTL_MAX_SECONDS,
} from '@/lib/activity-api-constants'
import {
  ACTIVITY_UPDATE_MODE_OPTIONS,
  type ActivityUpdateMode,
  DEFAULT_ACTIVITY_UPDATE_MODE,
  normalizeActivityUpdateMode,
} from '@/lib/activity-update-mode'
import { DEFAULT_PAGE_TITLE, PAGE_TITLE_MAX_LEN } from '@/lib/default-page-title'
import {
  HITOKOTO_CATEGORY_OPTIONS,
  normalizeHitokotoCategories,
  normalizeHitokotoEncode,
  type UserNoteHitokotoEncode,
} from '@/lib/hitokoto'
import { normalizeProfileOnlineAccentColor } from '@/lib/profile-online-accent-color'
import {
  isAllowedSlotMinutes,
  resolveSchedulePeriodTemplate,
  type ScheduleCourse,
  type SchedulePeriodTemplateItem,
} from '@/lib/schedule-courses'
import {
  resolveScheduleGridByWeekday,
  type ScheduleDayGrid,
} from '@/lib/schedule-grid-by-weekday'
import {
  clampSiteConfigHistoryWindowMinutes,
  clampSiteConfigProcessStaleSeconds,
  SITE_CONFIG_HISTORY_WINDOW_DEFAULT_MINUTES,
  SITE_CONFIG_HISTORY_WINDOW_MAX_MINUTES,
  SITE_CONFIG_HISTORY_WINDOW_MIN_MINUTES,
  SITE_CONFIG_PROCESS_STALE_DEFAULT_SECONDS,
  SITE_CONFIG_PROCESS_STALE_MAX_SECONDS,
  SITE_CONFIG_PROCESS_STALE_MIN_SECONDS,
  SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_DEFAULT,
  SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_MAX_LEN,
  SITE_CONFIG_SCHEDULE_SLOT_DEFAULT_MINUTES,
} from '@/lib/site-config-constants'
import {
  parseThemeCustomSurface,
  THEME_CUSTOM_SURFACE_DEFAULTS,
} from '@/lib/theme-custom-surface'
import { DEFAULT_TIMEZONE, normalizeTimezone, TIMEZONE_OPTIONS } from '@/lib/timezone'

/** Paginate tall “规则” cards */
const SETTINGS_RULES_PAGE_SIZE = 5
/** Paginate compact app-name rows */
const SETTINGS_APP_LIST_PAGE_SIZE = 10

function listMaxPage(total: number, pageSize: number): number {
  if (total <= 0) return 0
  return Math.max(0, Math.ceil(total / pageSize) - 1)
}

function ListPaginationBar({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number
  pageSize: number
  total: number
  onPageChange: (next: number) => void
}) {
  if (total <= pageSize) return null
  const maxPage = listMaxPage(total, pageSize)
  const safePage = Math.min(page, maxPage)
  const start = safePage * pageSize + 1
  const end = Math.min((safePage + 1) * pageSize, total)
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/50 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
      <span>
        已保存 {total} 条 · 本页 {start}–{end}
      </span>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8"
          disabled={safePage <= 0}
          onClick={() => onPageChange(Math.max(0, safePage - 1))}
        >
          上一页
        </Button>
        <span className="tabular-nums">
          {safePage + 1} / {maxPage + 1}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8"
          disabled={safePage >= maxPage}
          onClick={() => onPageChange(Math.min(maxPage, safePage + 1))}
        >
          下一页
        </Button>
      </div>
    </div>
  )
}

type ThemeCustomSurfaceForm = {
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
}

function emptyThemeCustomSurfaceForm(): ThemeCustomSurfaceForm {
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
  }
}

function themeCustomSurfaceFromApi(raw: unknown): ThemeCustomSurfaceForm {
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
  }
}

function base64ToUtf8(b64: string): string {
  const s = b64.replace(/\s/g, '')
  const bin = atob(s)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i)
  return new TextDecoder('utf-8').decode(bytes)
}

function parseExportPayload(encoded: string): { web: Record<string, unknown> } | null {
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

function normalizeRulesImport(rules: unknown): Array<{ match: string; text: string }> {
  if (!Array.isArray(rules)) return []
  return rules
    .map((r) => ({
      match: String((r as { match?: unknown })?.match ?? '').trim(),
      text: String((r as { text?: unknown })?.text ?? '').trim(),
    }))
    .filter((r) => r.match.length > 0 && r.text.length > 0)
}

function normalizeStringListImport(items: unknown): string[] {
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

function exportAppRulesJson(cfg: {
  appMessageRules: Array<{ match: string; text: string }>
  appMessageRulesShowProcessName: boolean
  appFilterMode: 'blacklist' | 'whitelist'
  appBlacklist: string[]
  appWhitelist: string[]
  appNameOnlyList: string[]
  mediaPlaySourceBlocklist: string[]
}): string {
  return JSON.stringify(
    {
      version: 1,
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

function parseAppRulesJson(raw: string): {
  ok: true
  data: {
    appMessageRules: Array<{ match: string; text: string }>
    appMessageRulesShowProcessName: boolean
    appFilterMode: 'blacklist' | 'whitelist'
    appBlacklist: string[]
    appWhitelist: string[]
    appNameOnlyList: string[]
    mediaPlaySourceBlocklist: string[]
  }
} | { ok: false; error: string } {
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return { ok: false, error: 'JSON 解析失败' }
  }
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    return { ok: false, error: 'JSON 顶层必须是对象' }
  }
  const o = json as Record<string, unknown>
  if (typeof o.version === 'number' && o.version !== 1) {
    return { ok: false, error: '不支持的 version' }
  }
  const rules = o.rules
  if (!rules || typeof rules !== 'object' || Array.isArray(rules)) {
    return { ok: false, error: '缺少 rules 对象' }
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
function webPayloadToFormPatch(web: Record<string, unknown>): Partial<SiteConfig> {
  const patch: Partial<SiteConfig> = {}
  if ('pageTitle' in web && typeof web.pageTitle === 'string') {
    const t = web.pageTitle.trim()
    patch.pageTitle = t ? t.slice(0, PAGE_TITLE_MAX_LEN) : DEFAULT_PAGE_TITLE
  }
  if ('userName' in web && typeof web.userName === 'string') patch.userName = web.userName.trim()
  if ('userBio' in web && typeof web.userBio === 'string') patch.userBio = web.userBio.trim()
  if ('avatarUrl' in web && typeof web.avatarUrl === 'string') patch.avatarUrl = web.avatarUrl.trim()
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
    patch.currentlyText = web.currentlyText.trim() || '当前状态'
  }
  if ('earlierText' in web && typeof web.earlierText === 'string') {
    patch.earlierText = web.earlierText.trim() || '最近的随想录'
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
  if (
    'scheduleHomeShowNextUpcoming' in web &&
    typeof web.scheduleHomeShowNextUpcoming === 'boolean'
  ) {
    patch.scheduleHomeShowNextUpcoming = web.scheduleHomeShowNextUpcoming
  }
  if (
    'scheduleHomeAfterClassesLabel' in web &&
    typeof web.scheduleHomeAfterClassesLabel === 'string'
  ) {
    const t = web.scheduleHomeAfterClassesLabel.trim()
    patch.scheduleHomeAfterClassesLabel = (t.length > 0 ? t : SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_DEFAULT).slice(
      0,
      SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_MAX_LEN,
    )
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
  if (
    'activityRejectLockappSleep' in web &&
    typeof web.activityRejectLockappSleep === 'boolean'
  ) {
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

interface SiteConfig {
  pageTitle: string
  userName: string
  userBio: string
  avatarUrl: string
  /** Empty = use theme --online; otherwise #RRGGBB */
  profileOnlineAccentColor: string
  /** Online status dot breathing animation (animate-pulse) */
  profileOnlinePulseEnabled: boolean
  userNote: string
  userNoteHitokotoEnabled: boolean
  userNoteHitokotoCategories: string[]
  userNoteHitokotoEncode: UserNoteHitokotoEncode
  userNoteHitokotoFallbackToNote: boolean
  themePreset: string
  themeCustomSurface: ThemeCustomSurfaceForm
  customCss: string
  mcpThemeToolsEnabled: boolean
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

type SkillsAiAuthorizationItem = {
  aiClientId: string
  pendingCodeCount: number
  approvedCodeCount: number
  activeTokenCount: number
  lastApprovedAt: string | null
  lastExchangedAt: string | null
}

type SkillsEditableConfig = {
  enabled: boolean
  authMode: 'oauth' | 'apikey' | ''
  oauthTokenTtlMinutes: number
}

function normalizeSkillsAiAuthorizations(raw: unknown): SkillsAiAuthorizationItem[] {
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

function formatIsoDatetime(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString()
}

function normalizeSkillsEditableConfig(raw: Partial<SkillsEditableConfig>): SkillsEditableConfig {
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

export function WebSettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [skillsSaving, setSkillsSaving] = useState(false)
  const [skillsEnabled, setSkillsEnabled] = useState(false)
  const [skillsAuthMode, setSkillsAuthMode] = useState<'oauth' | 'apikey' | ''>('')
  const [skillsApiKeyConfigured, setSkillsApiKeyConfigured] = useState(false)
  const [skillsOauthConfigured, setSkillsOauthConfigured] = useState(false)
  const [skillsOauthTokenTtlMinutes, setSkillsOauthTokenTtlMinutes] = useState(60)
  const [skillsAiAuthorizations, setSkillsAiAuthorizations] = useState<SkillsAiAuthorizationItem[]>([])
  const [skillsAiAuthDialogOpen, setSkillsAiAuthDialogOpen] = useState(false)
  const [revokeDialogAiClientId, setRevokeDialogAiClientId] = useState('')
  const [skillsRevokingAiClientId, setSkillsRevokingAiClientId] = useState('')
  const [skillsGeneratedApiKey, setSkillsGeneratedApiKey] = useState('')
  const [legacyMcpConfigured, setLegacyMcpConfigured] = useState(false)
  const [legacyMcpGeneratedApiKey, setLegacyMcpGeneratedApiKey] = useState('')
  const [publicOrigin, setPublicOrigin] = useState('')
  const [blacklistInput, setBlacklistInput] = useState('')
  const [whitelistInput, setWhitelistInput] = useState('')
  const [nameOnlyListInput, setNameOnlyListInput] = useState('')
  const [mediaSourceInput, setMediaSourceInput] = useState('')
  const [rulesListPage, setRulesListPage] = useState(0)
  const [blacklistListPage, setBlacklistListPage] = useState(0)
  const [whitelistListPage, setWhitelistListPage] = useState(0)
  const [nameOnlyListPage, setNameOnlyListPage] = useState(0)
  const [mediaSourceListPage, setMediaSourceListPage] = useState(0)
  const [dialogAppRulesOpen, setDialogAppRulesOpen] = useState(false)
  const [dialogAppFilterOpen, setDialogAppFilterOpen] = useState(false)
  const [dialogNameOnlyOpen, setDialogNameOnlyOpen] = useState(false)
  const [dialogMediaSourceOpen, setDialogMediaSourceOpen] = useState(false)
  const [importConfigDialogOpen, setImportConfigDialogOpen] = useState(false)
  const [importConfigInput, setImportConfigInput] = useState('')
  const [importRulesDialogOpen, setImportRulesDialogOpen] = useState(false)
  const [importRulesInput, setImportRulesInput] = useState('')
  const [historyApps, setHistoryApps] = useState<string[]>([])
  // 裁剪弹窗状态
  const [cropSourceUrl, setCropSourceUrl] = useState<string | null>(null)
  const [cropDialogOpen, setCropDialogOpen] = useState(false)
  const [inspirationDevices, setInspirationDevices] = useState<
    Array<{ id: number; displayName: string; generatedHashKey: string; status: string }>
  >([])

  const [baselineForm, setBaselineForm] = useState<SiteConfig | null>(null)
  const [baselineSkillsConfig, setBaselineSkillsConfig] = useState<SkillsEditableConfig | null>(null)
  /** Vercel + Redis: serverless forces activity-feed Redis cache on; switch is read-only. */
  const [redisCacheServerlessForced, setRedisCacheServerlessForced] = useState(false)

  const [form, setForm] = useState<SiteConfig>({
    pageTitle: DEFAULT_PAGE_TITLE,
    userName: '',
    userBio: '',
    avatarUrl: '',
    profileOnlineAccentColor: '',
    profileOnlinePulseEnabled: true,
    userNote: '',
    userNoteHitokotoEnabled: false,
    userNoteHitokotoCategories: [],
    userNoteHitokotoEncode: 'json',
    userNoteHitokotoFallbackToNote: false,
    themePreset: 'basic',
    themeCustomSurface: emptyThemeCustomSurfaceForm(),
    customCss: '',
    mcpThemeToolsEnabled: false,
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
    currentlyText: '当前状态',
    earlierText: '最近的随想录',
    adminText: 'admin',
    autoAcceptNewDevices: false,
    inspirationDeviceRestrictionEnabled: false,
    inspirationAllowedDeviceHashes: [],
    scheduleSlotMinutes: SITE_CONFIG_SCHEDULE_SLOT_DEFAULT_MINUTES,
    schedulePeriodTemplate: resolveSchedulePeriodTemplate(null),
    scheduleGridByWeekday: resolveScheduleGridByWeekday(null, SITE_CONFIG_SCHEDULE_SLOT_DEFAULT_MINUTES),
    scheduleCourses: [],
    scheduleIcs: '',
    scheduleInClassOnHome: false,
    scheduleHomeShowLocation: false,
    scheduleHomeShowTeacher: false,
    scheduleHomeShowNextUpcoming: false,
    scheduleHomeAfterClassesLabel: SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_DEFAULT,
    globalMouseTiltEnabled: false,
    globalMouseTiltGyroEnabled: false,
    hideActivityMedia: false,
    activityRejectLockappSleep: false,
    displayTimezone: DEFAULT_TIMEZONE,
    activityUpdateMode: DEFAULT_ACTIVITY_UPDATE_MODE,
    useNoSqlAsCacheRedis: true,
    redisCacheTtlSeconds: REDIS_ACTIVITY_FEED_CACHE_TTL_DEFAULT_SECONDS,
    steamEnabled: false,
    steamId: '',
    steamApiKey: '',
  })

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPublicOrigin(window.location.origin)
    }
  }, [])

  useEffect(() => {
    const load = async () => {
      try {
        const [settingsRes, skillsRes] = await Promise.all([
          fetch('/api/admin/settings'),
          fetch('/api/admin/skills'),
        ])
        const [data, skillsData] = await Promise.all([
          settingsRes.json().catch(() => null),
          skillsRes.json().catch(() => null),
        ])

        if (skillsData?.success && skillsData?.data) {
          const loadedSkills = normalizeSkillsEditableConfig({
            enabled: skillsData.data.enabled === true,
            authMode:
              skillsData.data.authMode === 'oauth' || skillsData.data.authMode === 'apikey'
                ? skillsData.data.authMode
                : '',
            oauthTokenTtlMinutes: skillsData.data.oauthTokenTtlMinutes,
          })
          setSkillsEnabled(loadedSkills.enabled)
          setSkillsAuthMode(loadedSkills.authMode)
          setSkillsApiKeyConfigured(skillsData.data.apiKeyConfigured === true)
          setSkillsOauthConfigured(skillsData.data.oauthConfigured === true)
          setSkillsOauthTokenTtlMinutes(loadedSkills.oauthTokenTtlMinutes)
          setBaselineSkillsConfig(structuredClone(loadedSkills))
          setSkillsAiAuthorizations(normalizeSkillsAiAuthorizations(skillsData.data.aiAuthorizations))
          setSkillsGeneratedApiKey('')
          setLegacyMcpConfigured(skillsData.data.legacyMcpConfigured === true)
          setLegacyMcpGeneratedApiKey('')
        } else if (skillsData !== null) {
          toast.error('加载 Skills 配置失败')
        }

        if (data?.success && data?.data) {
          const rules = Array.isArray(data.data.appMessageRules) ? data.data.appMessageRules : []
          const blacklist = Array.isArray(data.data.appBlacklist)
            ? data.data.appBlacklist
                .map((item: unknown) => String(item ?? '').trim())
                .filter((item: string) => item.length > 0)
            : []
          const whitelist = Array.isArray(data.data.appWhitelist)
            ? data.data.appWhitelist
                .map((item: unknown) => String(item ?? '').trim())
                .filter((item: string) => item.length > 0)
            : []
          const filterModeRaw = String(data.data.appFilterMode ?? 'blacklist').toLowerCase()
          const appFilterMode = filterModeRaw === 'whitelist' ? 'whitelist' : 'blacklist'
          const nameOnlyList = Array.isArray(data.data.appNameOnlyList)
            ? data.data.appNameOnlyList
                .map((item: unknown) => String(item ?? '').trim())
                .filter((item: string) => item.length > 0)
            : []
          const loaded: SiteConfig = {
            pageTitle: data.data.pageTitle ?? DEFAULT_PAGE_TITLE,
            userName: data.data.userName ?? '',
            userBio: data.data.userBio ?? '',
            avatarUrl: data.data.avatarUrl ?? '',
            profileOnlineAccentColor:
              normalizeProfileOnlineAccentColor(
                typeof data.data.profileOnlineAccentColor === 'string'
                  ? data.data.profileOnlineAccentColor
                  : '',
              ) ?? '',
            profileOnlinePulseEnabled: data.data.profileOnlinePulseEnabled !== false,
            userNote: data.data.userNote ?? '',
            userNoteHitokotoEnabled: Boolean(data.data.userNoteHitokotoEnabled),
            userNoteHitokotoCategories: normalizeHitokotoCategories(
              data.data.userNoteHitokotoCategories,
            ),
            userNoteHitokotoEncode: normalizeHitokotoEncode(data.data.userNoteHitokotoEncode),
            userNoteHitokotoFallbackToNote: Boolean(
              data.data.userNoteHitokotoFallbackToNote,
            ),
            themePreset: data.data.themePreset ?? 'basic',
            themeCustomSurface: themeCustomSurfaceFromApi(data.data.themeCustomSurface),
            customCss: data.data.customCss ?? '',
            mcpThemeToolsEnabled: data.data.mcpThemeToolsEnabled === true,
            aiToolMode: String(data.data.aiToolMode ?? '').trim().toLowerCase() === 'mcp' ? 'mcp' : 'skills',
            historyWindowMinutes: Number(
              data.data.historyWindowMinutes ?? SITE_CONFIG_HISTORY_WINDOW_DEFAULT_MINUTES,
            ),
            processStaleSeconds: Number(
              data.data.processStaleSeconds ?? SITE_CONFIG_PROCESS_STALE_DEFAULT_SECONDS,
            ),
            appMessageRules: rules,
            appMessageRulesShowProcessName: data.data.appMessageRulesShowProcessName !== false,
            appFilterMode,
            appBlacklist: blacklist,
            appWhitelist: whitelist,
            appNameOnlyList: nameOnlyList,
            captureReportedAppsEnabled: data.data.captureReportedAppsEnabled !== false,
            mediaPlaySourceBlocklist: Array.isArray(data.data.mediaPlaySourceBlocklist)
              ? (data.data.mediaPlaySourceBlocklist as unknown[])
                  .map((item) => String(item ?? '').trim().toLowerCase())
                  .filter((item) => item.length > 0)
              : [],
            pageLockEnabled: Boolean(data.data.pageLockEnabled),
            pageLockPassword: '',
            hcaptchaEnabled: Boolean(data.data.hcaptchaEnabled),
            hcaptchaSiteKey: data.data.hcaptchaSiteKey ?? '',
            hcaptchaSecretKey: '',
            currentlyText: data.data.currentlyText ?? '当前状态',
            earlierText: data.data.earlierText ?? '最近的随想录',
            adminText: data.data.adminText ?? 'admin',
            autoAcceptNewDevices: Boolean(data.data.autoAcceptNewDevices),
            inspirationDeviceRestrictionEnabled: Array.isArray(
              data.data.inspirationAllowedDeviceHashes,
            ),
            inspirationAllowedDeviceHashes: Array.isArray(data.data.inspirationAllowedDeviceHashes)
              ? (data.data.inspirationAllowedDeviceHashes as unknown[])
                  .map((item) => String(item ?? '').trim())
                  .filter((item) => item.length > 0)
              : [],
            scheduleSlotMinutes: isAllowedSlotMinutes(Number(data.data.scheduleSlotMinutes))
              ? Number(data.data.scheduleSlotMinutes)
              : SITE_CONFIG_SCHEDULE_SLOT_DEFAULT_MINUTES,
            schedulePeriodTemplate: resolveSchedulePeriodTemplate(data.data.schedulePeriodTemplate),
            scheduleGridByWeekday: resolveScheduleGridByWeekday(
              data.data.scheduleGridByWeekday,
              isAllowedSlotMinutes(Number(data.data.scheduleSlotMinutes))
                ? Number(data.data.scheduleSlotMinutes)
                : SITE_CONFIG_SCHEDULE_SLOT_DEFAULT_MINUTES,
            ),
            scheduleCourses: Array.isArray(data.data.scheduleCourses)
              ? (data.data.scheduleCourses as ScheduleCourse[])
              : [],
            scheduleIcs: typeof data.data.scheduleIcs === 'string' ? data.data.scheduleIcs : '',
            scheduleInClassOnHome: Boolean(data.data.scheduleInClassOnHome),
            scheduleHomeShowLocation: Boolean(data.data.scheduleHomeShowLocation),
            scheduleHomeShowTeacher: Boolean(data.data.scheduleHomeShowTeacher),
            scheduleHomeShowNextUpcoming: Boolean(data.data.scheduleHomeShowNextUpcoming),
            scheduleHomeAfterClassesLabel:
              typeof data.data.scheduleHomeAfterClassesLabel === 'string' &&
              data.data.scheduleHomeAfterClassesLabel.trim().length > 0
                ? data.data.scheduleHomeAfterClassesLabel.trim().slice(
                    0,
                    SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_MAX_LEN,
                  )
                : SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_DEFAULT,
            globalMouseTiltEnabled: data.data.globalMouseTiltEnabled === true,
            globalMouseTiltGyroEnabled: data.data.globalMouseTiltGyroEnabled === true,
            hideActivityMedia: data.data.hideActivityMedia === true,
            activityRejectLockappSleep: data.data.activityRejectLockappSleep === true,
            displayTimezone: normalizeTimezone(data.data.displayTimezone),
            activityUpdateMode: normalizeActivityUpdateMode(data.data.activityUpdateMode),
            useNoSqlAsCacheRedis:
              data.data.useNoSqlAsCacheRedis === undefined
                ? true
                : data.data.useNoSqlAsCacheRedis === true,
            redisCacheTtlSeconds: Number(
              data.data.redisCacheTtlSeconds ?? REDIS_ACTIVITY_FEED_CACHE_TTL_DEFAULT_SECONDS,
            ),
            steamEnabled: Boolean(data.data.steamEnabled),
            steamId: String(data.data.steamId ?? ''),
            steamApiKey: '',
          }
          setRedisCacheServerlessForced(data.data.redisCacheServerlessForced === true)
          setForm(loaded)
          setBaselineForm(structuredClone(loaded))
        }
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  const saveSkillsConfig = async (
    patch: {
      enabled?: boolean
      authMode?: 'oauth' | 'apikey'
      rotateApiKey?: boolean
      rotateLegacyMcpKey?: boolean
      revokeOauthForAiClientId?: string
      oauthTokenTtlMinutes?: number
    },
    options?: {
      successMessage?: string | null
    },
  ) => {
    setSkillsSaving(true)
    try {
      const res = await fetch('/api/admin/skills', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const json = await res.json().catch(() => null)
      if (!json?.success) {
        toast.error(json?.error || `保存失败（HTTP ${res.status}）`)
        return
      }
      setSkillsEnabled(json.data?.enabled === true)
      setSkillsAuthMode(
        json.data?.authMode === 'oauth' || json.data?.authMode === 'apikey' ? json.data.authMode : '',
      )
      setSkillsApiKeyConfigured(json.data?.apiKeyConfigured === true)
      setSkillsOauthConfigured(json.data?.oauthConfigured === true)
      setSkillsOauthTokenTtlMinutes(
        Number.isFinite(Number(json.data?.oauthTokenTtlMinutes))
          ? Number(json.data.oauthTokenTtlMinutes)
          : 60,
      )
      setSkillsAiAuthorizations(normalizeSkillsAiAuthorizations(json.data?.aiAuthorizations))
      setSkillsGeneratedApiKey(typeof json.data?.generatedApiKey === 'string' ? json.data.generatedApiKey : '')
      setLegacyMcpConfigured(json.data?.legacyMcpConfigured === true)
      setLegacyMcpGeneratedApiKey(
        typeof json.data?.generatedLegacyMcpApiKey === 'string' ? json.data.generatedLegacyMcpApiKey : '',
      )
      if (options?.successMessage !== null) {
        toast.success(options?.successMessage || '已保存 Skills 设置')
      }
    } catch (e) {
      console.error(e)
      toast.error('保存失败')
    } finally {
      setSkillsSaving(false)
    }
  }

  const revokeSkillsOauthByAiClientId = async (aiClientId: string) => {
    const normalized = String(aiClientId ?? '').trim().toLowerCase()
    if (!normalized) return
    setSkillsRevokingAiClientId(normalized)
    try {
      await saveSkillsConfig({ revokeOauthForAiClientId: normalized }, { successMessage: null })
      toast.success(`已撤销 AI ${normalized} 的 OAuth 授权`)
    } finally {
      setSkillsRevokingAiClientId('')
      setRevokeDialogAiClientId('')
    }
  }

  useEffect(() => {
    if (!form.captureReportedAppsEnabled) {
      setHistoryApps([])
      return
    }
    void (async () => {
      try {
        const res = await fetch('/api/admin/activity/history/apps?limit=200')
        const data = await res.json()
        if (data?.success && Array.isArray(data.data)) {
          const apps = (data.data as Array<{ processName?: unknown }>)
            .map((x) => String(x?.processName ?? '').trim())
            .filter((x) => x.length > 0)
          setHistoryApps(apps)
        }
      } catch {
        // ignore
      }
    })()
  }, [form.captureReportedAppsEnabled])

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/admin/devices?limit=200')
        const data = await res.json()
        if (data?.success && Array.isArray(data.data)) {
          setInspirationDevices(data.data)
        }
      } catch {
        // ignore
      }
    })()
  }, [])

  useEffect(() => {
    setRulesListPage((p) => Math.min(p, listMaxPage(form.appMessageRules.length, SETTINGS_RULES_PAGE_SIZE)))
  }, [form.appMessageRules.length])

  useEffect(() => {
    setBlacklistListPage((p) => Math.min(p, listMaxPage(form.appBlacklist.length, SETTINGS_APP_LIST_PAGE_SIZE)))
  }, [form.appBlacklist.length])

  useEffect(() => {
    setWhitelistListPage((p) => Math.min(p, listMaxPage(form.appWhitelist.length, SETTINGS_APP_LIST_PAGE_SIZE)))
  }, [form.appWhitelist.length])

  useEffect(() => {
    setNameOnlyListPage((p) => Math.min(p, listMaxPage(form.appNameOnlyList.length, SETTINGS_APP_LIST_PAGE_SIZE)))
  }, [form.appNameOnlyList.length])

  useEffect(() => {
    setMediaSourceListPage((p) =>
      Math.min(p, listMaxPage(form.mediaPlaySourceBlocklist.length, SETTINGS_APP_LIST_PAGE_SIZE)),
    )
  }, [form.mediaPlaySourceBlocklist.length])

  const patch = <K extends keyof SiteConfig>(key: K, value: SiteConfig[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const patchThemeSurface = <K extends keyof ThemeCustomSurfaceForm>(
    key: K,
    value: ThemeCustomSurfaceForm[K],
  ) => {
    setForm((prev) => ({
      ...prev,
      themeCustomSurface: { ...prev.themeCustomSurface, [key]: value },
    }))
  }

  const onFileSelected = (file?: File) => {
    if (!file) return
    if (cropSourceUrl) URL.revokeObjectURL(cropSourceUrl)
    const objectUrl = URL.createObjectURL(file)
    setCropSourceUrl(objectUrl)
    setCropDialogOpen(true)
  }

  const save = async () => {
    setSaving(true)
    try {
      const normalizeStringList = (items: string[]) => {
        const output: string[] = []
        const seen = new Set<string>()
        for (const raw of items) {
          const value = String(raw ?? '').trim()
          if (!value) continue
          const key = value.toLowerCase()
          if (seen.has(key)) continue
          seen.add(key)
          output.push(value)
        }
        return output
      }

      const normalizeRules = (rules: Array<{ match: string; text: string }>) => {
        return rules
          .map((r) => ({
            match: String(r?.match ?? '').trim(),
            text: String(r?.text ?? '').trim(),
          }))
          .filter((r) => r.match.length > 0 && r.text.length > 0)
      }

      const parsedRules = normalizeRules(form.appMessageRules)
      const parsedBlacklist = normalizeStringList(form.appBlacklist)
      const parsedWhitelist = normalizeStringList(form.appWhitelist)
      const parsedNameOnlyList = normalizeStringList(form.appNameOnlyList)
      const parsedMediaSourceBlocklist = normalizeStringList(form.mediaPlaySourceBlocklist).map((s) =>
        s.toLowerCase(),
      )

      const poTrim = form.profileOnlineAccentColor.trim()
      if (poTrim && !normalizeProfileOnlineAccentColor(poTrim)) {
        toast.error('头像在线色格式无效，请使用 #RRGGBB 或留空')
        setSaving(false)
        return
      }

      const {
        inspirationDeviceRestrictionEnabled,
        inspirationAllowedDeviceHashes: inspirationHashSelection,
        hcaptchaSecretKey: hcaptchaSecretKeyForm,
        steamApiKey: steamApiKeyForm,
        ...formRest
      } = form
      const normalizedRedisTtl = Number.isFinite(formRest.redisCacheTtlSeconds)
        ? Math.min(
            REDIS_ACTIVITY_FEED_CACHE_TTL_MAX_SECONDS,
            Math.max(1, Math.round(formRest.redisCacheTtlSeconds)),
          )
        : REDIS_ACTIVITY_FEED_CACHE_TTL_DEFAULT_SECONDS

      const hcaptchaPatch: Record<string, unknown> = {
        hcaptchaEnabled: formRest.hcaptchaEnabled,
        hcaptchaSiteKey: formRest.hcaptchaSiteKey || null,
      }
      if (hcaptchaSecretKeyForm.trim()) {
        hcaptchaPatch.hcaptchaSecretKey = hcaptchaSecretKeyForm.trim()
      }

      const steamPatch: Record<string, unknown> = {}
      if (steamApiKeyForm.trim()) {
        steamPatch.steamApiKey = steamApiKeyForm.trim()
      }

      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formRest,
          mcpThemeToolsEnabled: form.mcpThemeToolsEnabled,
          redisCacheTtlSeconds: normalizedRedisTtl,
          profileOnlineAccentColor: normalizeProfileOnlineAccentColor(poTrim || '') ?? null,
          appMessageRules: parsedRules,
          appBlacklist: parsedBlacklist,
          appWhitelist: parsedWhitelist,
          appNameOnlyList: parsedNameOnlyList,
          captureReportedAppsEnabled: form.captureReportedAppsEnabled,
          mediaPlaySourceBlocklist: parsedMediaSourceBlocklist,
          inspirationAllowedDeviceHashes: inspirationDeviceRestrictionEnabled
            ? normalizeStringList(inspirationHashSelection)
            : null,
          ...hcaptchaPatch,
          ...steamPatch,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data?.success) {
        toast.error(data?.error || '保存失败')
        return
      }
      const skillsPatch = normalizeSkillsEditableConfig({
        enabled: skillsEnabled,
        authMode: skillsAuthMode,
        oauthTokenTtlMinutes: skillsOauthTokenTtlMinutes,
      })
      const skillsRes = await fetch('/api/admin/skills', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: skillsPatch.enabled,
          authMode: skillsPatch.authMode || undefined,
          oauthTokenTtlMinutes: skillsPatch.oauthTokenTtlMinutes,
        }),
      })
      const skillsJson = await skillsRes.json().catch(() => null)
      if (!skillsRes.ok || !skillsJson?.success) {
        toast.error(skillsJson?.error || 'Skills 设置保存失败，请重试')
        return
      }

      const serverSkills = normalizeSkillsEditableConfig({
        enabled: skillsJson.data?.enabled === true,
        authMode:
          skillsJson.data?.authMode === 'oauth' || skillsJson.data?.authMode === 'apikey'
            ? skillsJson.data.authMode
            : '',
        oauthTokenTtlMinutes: skillsJson.data?.oauthTokenTtlMinutes,
      })
      setSkillsEnabled(serverSkills.enabled)
      setSkillsAuthMode(serverSkills.authMode)
      setSkillsOauthTokenTtlMinutes(serverSkills.oauthTokenTtlMinutes)
      setSkillsApiKeyConfigured(skillsJson.data?.apiKeyConfigured === true)
      setSkillsOauthConfigured(skillsJson.data?.oauthConfigured === true)
      setLegacyMcpConfigured(skillsJson.data?.legacyMcpConfigured === true)
      setSkillsAiAuthorizations(normalizeSkillsAiAuthorizations(skillsJson.data?.aiAuthorizations))
      setBaselineSkillsConfig(structuredClone(serverSkills))

      toast.success('保存成功，主页刷新后生效')
      setRedisCacheServerlessForced(data?.data?.redisCacheServerlessForced === true)
      const nextForm =
        data?.data && typeof data.data.useNoSqlAsCacheRedis === 'boolean'
          ? { ...form, useNoSqlAsCacheRedis: data.data.useNoSqlAsCacheRedis === true }
          : form
      setForm(nextForm)
      setBaselineForm(structuredClone(nextForm))
    } catch {
      toast.error('网络异常，请重试')
    } finally {
      setSaving(false)
    }
  }

  const revertUnsavedWebSettings = () => {
    if (!baselineForm) return
    setForm(structuredClone(baselineForm))
    if (baselineSkillsConfig) {
      setSkillsEnabled(baselineSkillsConfig.enabled)
      setSkillsAuthMode(baselineSkillsConfig.authMode)
      setSkillsOauthTokenTtlMinutes(baselineSkillsConfig.oauthTokenTtlMinutes)
    }
  }

  const copyExportConfig = async () => {
    try {
      const res = await fetch('/api/admin/settings/export')
      const data = await res.json()
      if (!res.ok || !data?.success || !data?.data?.encoded) {
        toast.error(typeof data?.error === 'string' ? data.error : '导出失败')
        return
      }

      await navigator.clipboard.writeText(data.data.encoded)
      toast.success('已复制接入配置到剪贴板')
    } catch {
      toast.error('复制失败，请重试')
    }
  }

  const applyImportConfig = async () => {
    let raw = ''
    try {
      raw = (await navigator.clipboard.readText()).trim()
    } catch {
      raw = ''
    }
    setImportConfigInput(raw)
    setImportConfigDialogOpen(true)
  }

  const confirmImportConfig = () => {
    const raw = importConfigInput.trim()
    if (!raw) {
      toast.error('请先粘贴 Base64 接入配置')
      return
    }
    const compact = raw.replace(/\s+/g, '')
    const parsed = parseExportPayload(compact)
    if (!parsed) {
      toast.error('格式无效：请确认是本站「一键复制接入配置」导出的 Base64 全文')
      return
    }
    const partial = webPayloadToFormPatch(parsed.web)
    setForm((prev) => ({
      ...prev,
      ...partial,
      pageLockPassword: '',
    }))
    setBlacklistInput('')
    setWhitelistInput('')
    setNameOnlyListInput('')
    setRulesListPage(0)
    setBlacklistListPage(0)
    setWhitelistListPage(0)
    setNameOnlyListPage(0)
    setMediaSourceListPage(0)
    setImportConfigDialogOpen(false)
    toast.success('已写入网页配置，请记得保存')
  }

  const copyRulesJson = async () => {
    try {
      const json = exportAppRulesJson({
        appMessageRules: form.appMessageRules,
        appMessageRulesShowProcessName: form.appMessageRulesShowProcessName,
        appFilterMode: form.appFilterMode,
        appBlacklist: form.appBlacklist,
        appWhitelist: form.appWhitelist,
        appNameOnlyList: form.appNameOnlyList,
        mediaPlaySourceBlocklist: form.mediaPlaySourceBlocklist,
      })
      await navigator.clipboard.writeText(json)
      toast.success('已复制规则 JSON 到剪贴板')
    } catch {
      toast.error('复制失败，请重试')
    }
  }

  const copyPlainText = async (value: string, successText: string) => {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(successText)
    } catch {
      toast.error('复制失败，请重试')
    }
  }

  const exportUsedAppsJson = async () => {
    try {
      const res = await fetch('/api/admin/activity/apps-export')
      const data = await res.json()
      if (!res.ok || !data?.success || !data?.data) {
        toast.error(typeof data?.error === 'string' ? data.error : '导出失败')
        return
      }
      const payload = JSON.stringify(data.data, null, 2)
      const blob = new Blob([payload], { type: 'application/json;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const ts = new Date().toISOString().replace(/[:.]/g, '-')
      const a = document.createElement('a')
      a.href = url
      a.download = `apps-export-${ts}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success('已导出已使用应用 JSON')
    } catch {
      toast.error('导出失败，请重试')
    }
  }

  const openImportRules = () => {
    setImportRulesInput('')
    setImportRulesDialogOpen(true)
  }

  const confirmImportRules = () => {
    const raw = importRulesInput.trim()
    if (!raw) {
      toast.error('请先粘贴规则 JSON')
      return
    }
    const parsed = parseAppRulesJson(raw)
    if (!parsed.ok) {
      toast.error(parsed.error)
      return
    }
    setForm((prev) => ({
      ...prev,
      ...parsed.data,
    }))
    setBlacklistInput('')
    setWhitelistInput('')
    setNameOnlyListInput('')
    setMediaSourceInput('')
    setRulesListPage(0)
    setBlacklistListPage(0)
    setWhitelistListPage(0)
    setNameOnlyListPage(0)
    setMediaSourceListPage(0)
    setImportRulesDialogOpen(false)
    toast.success('已写入规则到表单，请记得保存')
  }

  const rulesTotal = form.appMessageRules.length
  const rulesMaxPage = listMaxPage(rulesTotal, SETTINGS_RULES_PAGE_SIZE)
  const rulesPage = Math.min(rulesListPage, rulesMaxPage)
  const rulesStart = rulesPage * SETTINGS_RULES_PAGE_SIZE

  const blTotal = form.appBlacklist.length
  const blMaxPage = listMaxPage(blTotal, SETTINGS_APP_LIST_PAGE_SIZE)
  const blPage = Math.min(blacklistListPage, blMaxPage)
  const blStart = blPage * SETTINGS_APP_LIST_PAGE_SIZE

  const wlTotal = form.appWhitelist.length
  const wlMaxPage = listMaxPage(wlTotal, SETTINGS_APP_LIST_PAGE_SIZE)
  const wlPage = Math.min(whitelistListPage, wlMaxPage)
  const wlStart = wlPage * SETTINGS_APP_LIST_PAGE_SIZE

  const noTotal = form.appNameOnlyList.length
  const noMaxPage = listMaxPage(noTotal, SETTINGS_APP_LIST_PAGE_SIZE)
  const noPage = Math.min(nameOnlyListPage, noMaxPage)
  const noStart = noPage * SETTINGS_APP_LIST_PAGE_SIZE

  const msTotal = form.mediaPlaySourceBlocklist.length
  const msMaxPage = listMaxPage(msTotal, SETTINGS_APP_LIST_PAGE_SIZE)
  const msPage = Math.min(mediaSourceListPage, msMaxPage)
  const msStart = msPage * SETTINGS_APP_LIST_PAGE_SIZE

  const webSettingsDirty = useMemo(() => {
    if (!baselineForm || !baselineSkillsConfig) return false
    try {
      const formDirty = JSON.stringify(form) !== JSON.stringify(baselineForm)
      if (formDirty) return true
      const currentSkills = normalizeSkillsEditableConfig({
        enabled: skillsEnabled,
        authMode: skillsAuthMode,
        oauthTokenTtlMinutes: skillsOauthTokenTtlMinutes,
      })
      return JSON.stringify(currentSkills) !== JSON.stringify(baselineSkillsConfig)
    } catch {
      return true
    }
  }, [
    form,
    baselineForm,
    baselineSkillsConfig,
    skillsEnabled,
    skillsAuthMode,
    skillsOauthTokenTtlMinutes,
  ])

  if (loading) {
    return <div className="text-sm text-muted-foreground">加载配置中...</div>
  }

  return (
    <>
    <div className="rounded-xl border bg-card p-6 space-y-5">
      <Tabs defaultValue="basic" className="space-y-5">
        <TabsList>
          <TabsTrigger value="basic">基础设置</TabsTrigger>
          <TabsTrigger value="advanced">进阶设置</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-5">
          <div className="space-y-2">
            <Label>网页标题（浏览器标签页）</Label>
            <Input
              value={form.pageTitle}
              maxLength={PAGE_TITLE_MAX_LEN}
              onChange={(e) => patch('pageTitle', e.target.value)}
              placeholder={DEFAULT_PAGE_TITLE}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>首页名称</Label>
              <Input value={form.userName} onChange={(e) => patch('userName', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>首页简介</Label>
              <Input value={form.userBio} onChange={(e) => patch('userBio', e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>首页备注</Label>
            <Input value={form.userNote} onChange={(e) => patch('userNote', e.target.value)} />
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/10 px-4 py-3">
            <div className="space-y-0.5 min-w-0">
              <Label htmlFor="hitokoto-home-note-basic" className="font-normal cursor-pointer">
                首页备注使用一言（hitokoto.cn）
              </Label>
              <p className="text-xs text-muted-foreground leading-relaxed">
                开启后由访客浏览器请求 <code className="rounded bg-muted px-1">v1.hitokoto.cn</code>。
              </p>
            </div>
            <Switch
              id="hitokoto-home-note-basic"
              checked={form.userNoteHitokotoEnabled}
              onCheckedChange={(v) => patch('userNoteHitokotoEnabled', v)}
              className="shrink-0"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="theme-preset-basic">主题预设</Label>
            <Select value={form.themePreset} onValueChange={(v) => patch('themePreset', v)}>
              <SelectTrigger id="theme-preset-basic" className="w-full">
                <SelectValue placeholder="选择主题预设" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="basic">Basic - 默认主题</SelectItem>
                <SelectItem value="obsidian">Obsidian - 纯黑极简</SelectItem>
                <SelectItem value="mono">Mono - 纯白极简</SelectItem>
                <SelectItem value="midnight">Midnight - 深邃蓝紫</SelectItem>
                <SelectItem value="ocean">Ocean - 深海蓝绿</SelectItem>
                <SelectItem value="nord">Nord - 北欧冷淡</SelectItem>
                <SelectItem value="forest">Forest - 自然森林</SelectItem>
                <SelectItem value="sakura">Sakura - 柔和樱花</SelectItem>
                <SelectItem value="lavender">Lavender - 淡雅薰衣草</SelectItem>
                <SelectItem value="amber">Amber - 温暖琥珀</SelectItem>
                <SelectItem value="customSurface">Custom surface - 自定义背景 / 圆角 / 配色</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">自定义背景 / CSS / 规则等请去「进阶设置」。</p>
          </div>

          <div className="space-y-2">
            <Label>头像地址（URL / DataURL）</Label>
            <Input value={form.avatarUrl} onChange={(e) => patch('avatarUrl', e.target.value)} />
            <p className="text-xs text-muted-foreground">可直接填写图片链接，或通过下方上传并裁剪后自动生成。</p>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                onFileSelected(e.target.files?.[0])
                e.target.value = ''
              }}
              className="w-full text-xs text-muted-foreground file:mr-3 file:px-3 file:py-1.5 file:rounded-md file:border file:border-border file:bg-muted/50 file:text-foreground hover:file:bg-muted file:cursor-pointer"
            />
            {cropSourceUrl ? (
              <button
                type="button"
                onClick={() => setCropDialogOpen(true)}
                className="px-3 py-1.5 border border-border rounded-md text-xs font-medium hover:bg-muted transition-colors"
              >
                重新打开裁剪
              </button>
            ) : null}
            {form.avatarUrl ? (
              <div className="flex items-center gap-3 rounded-md border border-border/60 bg-background/60 p-3">
                <Image
                  src={form.avatarUrl}
                  alt="头像预览"
                  width={40}
                  height={40}
                  className="w-10 h-10 rounded-full border border-border object-cover"
                />
                <span className="text-xs text-muted-foreground">头像预览</span>
              </div>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>当前区块标题</Label>
              <Input value={form.currentlyText} onChange={(e) => patch('currentlyText', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>随想录区块标题</Label>
              <Input value={form.earlierText} onChange={(e) => patch('earlierText', e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>后台入口文案</Label>
            <Input value={form.adminText} onChange={(e) => patch('adminText', e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.pageLockEnabled}
                onChange={(e) => patch('pageLockEnabled', e.target.checked)}
              />
              启用页面访问密码锁
            </Label>
            <Input
              type="password"
              placeholder="设置/更新页面访问密码（留空则不修改）"
              value={form.pageLockPassword}
              onChange={(e) => patch('pageLockPassword', e.target.value)}
            />
          </div>
        </TabsContent>

        <TabsContent value="advanced" className="space-y-5">
      <div className="rounded-lg border border-border/60 bg-muted/10 p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <Label className="font-normal">允许 AI 调试</Label>
            <p className="text-xs text-muted-foreground leading-relaxed">
              启用后，AI 可按你选择的模式进行调试。关闭后，Skills 与 MCP 都不会生效。
            </p>
          </div>
          <Switch
            checked={skillsEnabled}
            onCheckedChange={(v) => setSkillsEnabled(Boolean(v))}
            disabled={skillsSaving}
            className="shrink-0"
          />
        </div>

        <div className="space-y-2">
          <Label>调试模式</Label>
          <Select
            value={form.aiToolMode}
            onValueChange={(v) => {
              const nextMode = v === 'mcp' ? 'mcp' : 'skills'
              setForm((prev) => ({
                ...prev,
                aiToolMode: nextMode,
                mcpThemeToolsEnabled: nextMode === 'mcp' ? prev.mcpThemeToolsEnabled : false,
              }))
            }}
            disabled={!skillsEnabled}
          >
            <SelectTrigger className="w-full sm:max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="skills">Skill</SelectItem>
              <SelectItem value="mcp">MCP</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground leading-relaxed">
            选择 AI 调试时使用的工具链。切换后需要点击页面底部保存网页配置。
          </p>
          <div className="text-xs text-muted-foreground leading-relaxed rounded-md border border-border/60 bg-background/50 px-3 py-2">
            当前已选择 {form.aiToolMode === 'mcp' ? 'MCP' : 'Skill'}
          </div>
        </div>

        {skillsEnabled && form.aiToolMode === 'skills' ? (
          <div className="space-y-4 rounded-md border border-border/60 bg-muted/20 px-3 py-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>认证模式</Label>
                <Select
                  value={skillsAuthMode || ''}
                  onValueChange={(v) => {
                    const mode = v === 'oauth' || v === 'apikey' ? v : ''
                    setSkillsAuthMode(mode)
                  }}
                  disabled={skillsSaving}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="选择 OAuth / APIKEY" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="oauth">OAuth 授权链接（有效期可配置）</SelectItem>
                    <SelectItem value="apikey">APIKEY 认证（默认无限）</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>授权状态</Label>
                <div className="text-xs text-muted-foreground leading-relaxed rounded-md border border-border/60 bg-background/50 px-3 py-2">
                  {skillsAuthMode === 'oauth' ? (
                    <>
                      OAuth：{skillsOauthConfigured ? '已授权' : '未授权'}
                      {' '}· 以 AI 标识维度签发，可并存多个 token
                    </>
                  ) : skillsAuthMode === 'apikey' ? (
                    <>APIKEY：{skillsApiKeyConfigured ? '已配置' : '未配置（请生成/轮换）'}</>
                  ) : (
                    <>未选择认证模式</>
                  )}
                </div>
              </div>
            </div>

            {skillsAuthMode === 'apikey' ? (
              <div className="space-y-3 rounded-md border border-border/60 bg-background/40 px-3 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <Label className="text-sm font-normal">APIKEY</Label>
                    <p className="text-xs text-muted-foreground">
                      默认无限期；仅本次显示明文，请复制后妥善保存（后端仅存 hash）。
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={skillsSaving}
                    onClick={() => void saveSkillsConfig({ rotateApiKey: true })}
                  >
                    {skillsSaving ? '处理中…' : '生成 / 轮换 Key'}
                  </Button>
                </div>

                {skillsGeneratedApiKey ? (
                  <div className="space-y-2">
                    <Label className="text-xs">本次生成的 Key（请立即复制）</Label>
                    <Input value={skillsGeneratedApiKey} readOnly className="font-mono text-xs" />
                  </div>
                ) : null}
              </div>
            ) : null}

            {skillsAuthMode === 'oauth' ? (
              <div className="space-y-3 rounded-md border border-border/60 bg-background/40 px-3 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <Label className="text-sm font-normal">OAuth Key 有效期</Label>
                    <p className="text-xs text-muted-foreground">
                      code 兑换后的 key 有效期（分钟）。范围 5-1440。
                    </p>
                  </div>
                </div>
                <div className="max-w-xs space-y-2">
                  <Input
                    type="number"
                    onWheel={(e) => e.currentTarget.blur()}
                    min={5}
                    max={1440}
                    step={1}
                    value={skillsOauthTokenTtlMinutes}
                    onChange={(e) =>
                      setSkillsOauthTokenTtlMinutes(
                        Math.min(1440, Math.max(5, Math.round(Number(e.target.value) || 60))),
                      )
                    }
                    disabled={skillsSaving}
                  />  
                  <p className="text-[11px] text-muted-foreground">
                    当前设置：{skillsOauthTokenTtlMinutes} 分钟
                  </p>
                </div>
              </div>
            ) : null}

            {skillsAuthMode ? (
              <div className="space-y-2 rounded-md border border-border/60 bg-background/40 px-3 py-3">
                <Label className="text-xs">固定技能说明（完整链接）</Label>
                <div className="flex gap-2">
                  <Input
                    value={publicOrigin ? `${publicOrigin}/api/llm/md` : '/api/llm/md'}
                    readOnly
                    className="font-mono text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() =>
                      void copyPlainText(
                        publicOrigin ? `${publicOrigin}/api/llm/md` : '/api/llm/md',
                        '已复制 skills.md 链接',
                      )
                    }
                  >
                    一键复制
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  AI 必须先读取该文档；如使用 OAuth，必须声明并持续使用一个自己的固定 AI 名字。
                </p>

                <Label className="text-xs">Skills 直连链接（验证/指引）</Label>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  该链接用于验证 token 是否可用，并返回 AI 需要的{' '}
                  <code className="rounded bg-muted px-1">LLM-Skills-*</code> 请求头模板。
                  APIKEY 模式请在请求头填写 <code className="rounded bg-muted px-1">LLM-Skills-Token</code>；
                  OAuth 模式必须先确定一个自己的固定 AI 名字，再由 AI 自己携带该名字请求；这里不预填 AI 名字。
                </p>
                <div className="flex gap-2">
                  <Input
                    value={
                      publicOrigin
                        ? `${publicOrigin}/api/llm/direct?mode=${skillsAuthMode}`
                        : `/api/llm/direct?mode=${skillsAuthMode}`
                    }
                    readOnly
                    className="font-mono text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() =>
                      void copyPlainText(
                        publicOrigin
                          ? `${publicOrigin}/api/llm/direct?mode=${skillsAuthMode}`
                          : `/api/llm/direct?mode=${skillsAuthMode}`,
                        '已复制 Skills 直连链接',
                      )
                    }
                  >
                    一键复制
                  </Button>
                </div>
              </div>
            ) : null}

            {skillsAuthMode === 'oauth' ? (
              <div className="space-y-3 rounded-md border border-border/60 bg-background/40 px-3 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <Label className="text-xs">AI 授权情况</Label>
                    <p className="text-[11px] text-muted-foreground">
                      按 AI 标识展示；仅显示脱敏状态，不显示 code/key 明文。
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSkillsAiAuthDialogOpen(true)}
                  >
                    查看授权情况
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  当前记录数：{skillsAiAuthorizations.length}（点击「查看授权情况」在弹窗中管理）
                </p>
                <Dialog open={skillsAiAuthDialogOpen} onOpenChange={setSkillsAiAuthDialogOpen}>
                  <DialogContent className="sm:max-w-3xl">
                    <DialogHeader>
                      <DialogTitle>AI 授权情况</DialogTitle>
                      <DialogDescription>
                        按 AI 标识查看授权统计与有效 token，可在此执行按 AI 撤销授权。
                      </DialogDescription>
                    </DialogHeader>
                    {skillsAiAuthorizations.length > 0 ? (
                      <div className="max-h-[60vh] overflow-auto space-y-2 pr-1">
                        {skillsAiAuthorizations.map((item) => (
                          <div
                            key={item.aiClientId}
                            className="rounded-md border border-border/60 bg-muted/20 px-3 py-3 space-y-2"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <code className="text-xs rounded bg-muted px-1.5 py-0.5">{item.aiClientId}</code>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={skillsSaving || skillsRevokingAiClientId === item.aiClientId}
                                onClick={() => setRevokeDialogAiClientId(item.aiClientId)}
                              >
                                {skillsRevokingAiClientId === item.aiClientId ? '撤销中…' : '撤销该 AI 授权'}
                              </Button>
                            </div>
                            <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                              <span>待确认 code：{item.pendingCodeCount}</span>
                              <span>已确认未兑换 code：{item.approvedCodeCount}</span>
                              <span>有效 token：{item.activeTokenCount}</span>
                            </div>
                            <div className="grid gap-2 text-[11px] text-muted-foreground sm:grid-cols-2">
                              <span>最近确认：{formatIsoDatetime(item.lastApprovedAt)}</span>
                              <span>最近兑换：{formatIsoDatetime(item.lastExchangedAt)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">暂无 AI 授权记录</p>
                    )}
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setSkillsAiAuthDialogOpen(false)}>
                        关闭
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <Dialog
                  open={Boolean(revokeDialogAiClientId)}
                  onOpenChange={(open) => {
                    if (!open) setRevokeDialogAiClientId('')
                  }}
                >
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>确认撤销 AI OAuth 授权</DialogTitle>
                      <DialogDescription>
                        将撤销该 AI 标识下所有仍有效的 OAuth token。此操作会立即生效。
                      </DialogDescription>
                    </DialogHeader>
                    <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs">
                      AI 标识：<code>{revokeDialogAiClientId || '—'}</code>
                    </div>
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setRevokeDialogAiClientId('')}
                        disabled={skillsSaving || Boolean(skillsRevokingAiClientId)}
                      >
                        取消
                      </Button>
                      <Button
                        type="button"
                        onClick={() => void revokeSkillsOauthByAiClientId(revokeDialogAiClientId)}
                        disabled={
                          !revokeDialogAiClientId || skillsSaving || Boolean(skillsRevokingAiClientId)
                        }
                      >
                        确认撤销
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            ) : null}
          </div>
        ) : null}

        {skillsEnabled && form.aiToolMode === 'mcp' ? (
          <div className="space-y-4 rounded-md border border-border/60 bg-muted/20 px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <Label className="font-normal">启用 MCP</Label>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  使用数据库中的 deprecated 字段 <code className="rounded bg-muted px-1">mcpThemeToolsEnabled</code>{' '}
                  控制是否启用。默认只接受独立 MCP API Key。
                </p>
              </div>
              <Switch
                checked={form.mcpThemeToolsEnabled}
                onCheckedChange={(v) => patch('mcpThemeToolsEnabled', Boolean(v))}
                className="shrink-0"
              />
            </div>

            <div className="text-xs text-muted-foreground leading-relaxed rounded-md border border-border/60 bg-background/50 px-3 py-2">
              选中 MCP 后，Skills HTTP 调试接口会自动关闭；切回 Skill 后，MCP 也会自动关闭。
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>MCP 状态</Label>
                <div className="text-xs text-muted-foreground leading-relaxed rounded-md border border-border/60 bg-background/50 px-3 py-2">
                  {form.mcpThemeToolsEnabled ? 'MCP 已启用' : 'MCP 未启用'}
                  {' '}· API Key：{legacyMcpConfigured ? '已配置' : '未配置（请生成/轮换）'}
                </div>
              </div>

              <div className="space-y-2">
                <Label>认证模式</Label>
                <div className="text-xs text-muted-foreground leading-relaxed rounded-md border border-border/60 bg-background/50 px-3 py-2">
                  API Key Only
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded-md border border-border/60 bg-background/40 px-3 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <Label className="text-sm font-normal">独立 MCP API Key</Label>
                  <p className="text-xs text-muted-foreground">
                    仅供旧式 MCP endpoint 和专用校验接口使用，和 Skills API Key 分离。
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={skillsSaving}
                  onClick={() => void saveSkillsConfig({ rotateLegacyMcpKey: true })}
                >
                  {skillsSaving ? '处理中…' : '生成 / 轮换 Key'}
                </Button>
              </div>

              {legacyMcpGeneratedApiKey ? (
                <div className="space-y-2">
                  <Label className="text-xs">本次生成的 MCP Key（请立即复制）</Label>
                  <Input value={legacyMcpGeneratedApiKey} readOnly className="font-mono text-xs" />
                </div>
              ) : null}
            </div>

            <div className="space-y-2 rounded-md border border-border/60 bg-background/40 px-3 py-3">
              <Label className="text-xs">MCP API Key 校验地址</Label>
              <div className="flex gap-2">
                <Input
                  value={publicOrigin ? `${publicOrigin}/api/llm/mcp/apikey` : '/api/llm/mcp/apikey'}
                  readOnly
                  className="font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() =>
                    void copyPlainText(
                      publicOrigin ? `${publicOrigin}/api/llm/mcp/apikey` : '/api/llm/mcp/apikey',
                      '已复制 MCP API Key 校验地址',
                    )
                  }
                >
                  一键复制
                </Button>
              </div>
            </div>

            <div className="space-y-2 rounded-md border border-border/60 bg-background/40 px-3 py-3">
              <Label className="text-xs">MCP Endpoint</Label>
              <div className="flex gap-2">
                <Input
                  value={publicOrigin ? `${publicOrigin}/api/llm/mcp` : '/api/llm/mcp'}
                  readOnly
                  className="font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() =>
                    void copyPlainText(
                      publicOrigin ? `${publicOrigin}/api/llm/mcp` : '/api/llm/mcp',
                      '已复制 MCP endpoint',
                    )
                  }
                >
                  一键复制
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                默认使用 <code className="rounded bg-muted px-1">Authorization: Bearer YOUR_LEGACY_MCP_APIKEY</code>{' '}
                认证。切换开关后，记得点击页面底部保存网页配置。
              </p>
            </div>
          </div>
        ) : null}

        {!skillsEnabled ? (
          <div className="text-xs text-muted-foreground leading-relaxed rounded-md border border-border/60 bg-background/50 px-3 py-2">
            当前未开启“允许 AI 调试”，因此不会展示当前模式的详细配置。
          </div>
        ) : null}
      </div>

      <div className="rounded-lg border border-border/60 bg-muted/10 p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="hitokoto-home-note" className="font-normal cursor-pointer">
            首页备注使用一言（hitokoto.cn）
          </Label>
          <Switch
            id="hitokoto-home-note"
            checked={form.userNoteHitokotoEnabled}
            onCheckedChange={(v) => patch('userNoteHitokotoEnabled', v)}
          />
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          开启后由访客浏览器请求 <code className="rounded bg-muted px-1">v1.hitokoto.cn</code>；
          句子类型可多选；不选表示不限制类型（与官方默认一致）。
        </p>
        {form.userNoteHitokotoEnabled ? (
          <div className="space-y-4 pt-1">
            <div className="space-y-2">
              <Label htmlFor="hitokoto-encode">返回编码 encode</Label>
              <Select
                value={form.userNoteHitokotoEncode}
                onValueChange={(v) =>
                  patch('userNoteHitokotoEncode', v === 'text' ? 'text' : 'json')
                }
              >
                <SelectTrigger id="hitokoto-encode" className="w-full max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="json">json（可带 uuid 跳转出处）</SelectItem>
                  <SelectItem value="text">text（纯文本）</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/70 px-4 py-3">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">一言不可用时使用备注回退</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  关闭后会直接显示“一言暂不可用”，不再自动使用上方静态备注。
                </p>
              </div>
              <Switch
                id="hitokoto-home-note-fallback"
                checked={form.userNoteHitokotoFallbackToNote}
                onCheckedChange={(v) => patch('userNoteHitokotoFallbackToNote', v)}
              />
            </div>
            <div className="space-y-2">
              <Label>句子类型 c（可多选）</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {HITOKOTO_CATEGORY_OPTIONS.map((opt) => (
                  <label
                    key={opt.id}
                    className="flex items-center gap-2 text-sm font-normal cursor-pointer"
                  >
                    <Checkbox
                      checked={form.userNoteHitokotoCategories.includes(opt.id)}
                      onCheckedChange={(v) => {
                        const checked = v === true
                        setForm((prev) => {
                          const cur = prev.userNoteHitokotoCategories
                          const next = checked
                            ? Array.from(new Set([...cur, opt.id]))
                            : cur.filter((x) => x !== opt.id)
                          return { ...prev, userNoteHitokotoCategories: next }
                        })
                      }}
                    />
                    <span>
                      {opt.id} · {opt.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {form.themePreset === 'customSurface' ? (
        <div className="space-y-4 rounded-lg border border-border/60 bg-muted/15 p-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            留空则使用内置暖色默认。支持 oklch()、#hex、linear-gradient、以及安全的{' '}
            <code className="rounded bg-muted px-1">url()</code>
            背景图：可使用{' '}
            <code className="rounded bg-muted px-1">https://…</code>、<code className="rounded bg-muted px-1">http://…</code>、站内路径{' '}
            <code className="rounded bg-muted px-1">/images/bg.jpg</code>、相对路径{' '}
            <code className="rounded bg-muted px-1">./a.png</code>，或{' '}
            <code className="rounded bg-muted px-1">data:image/…;base64,…</code>
            （勿在地址里含未转义的右括号）。仍会过滤尖括号、花括号、@import 等。
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            上面列出的多行是「各字段示例」，请分别填进对应输入框，不要把整段粘进某一个框。
            <code className="rounded bg-muted px-1">url(&quot;…&quot;)</code> 与后面的渐变要写在「动效背景层」里，用英文逗号连成一条{' '}
            <code className="rounded bg-muted px-1">background</code> 值（第一层画在最上）。
            「整页 background」写在 <code className="rounded bg-muted px-1">body</code> 上，与「页面底色」分开。
            主题预设必须选 Custom surface，保存后才会注入首页。
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>页面底色（仅 background-color / 令牌）</Label>
              <p className="text-xs text-muted-foreground">
                对应 <code className="rounded bg-muted px-1">--background</code>、
                <code className="rounded bg-muted px-1">--color-background</code>
                ，供 Tailwind <code className="rounded bg-muted px-1">bg-background</code> 等使用；不会生成{' '}
                <code className="rounded bg-muted px-1">background:</code> 简写。
                全屏的 <code className="rounded bg-muted px-1">.animated-bg</code> 叠在{' '}
                <code className="rounded bg-muted px-1">body</code> 上面：若下面「动效背景层」留空，仍会使用内置暖色渐变盖住这里，看起来像「没改底色」——请勾选「关闭动效渐变层」或改写下方的动效层。
              </p>
              <Input
                value={form.themeCustomSurface.background}
                onChange={(e) => patchThemeSurface('background', e.target.value)}
                placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.background}
                className="font-mono text-xs max-w-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>主色 (--primary)</Label>
              <Input
                value={form.themeCustomSurface.primary}
                onChange={(e) => patchThemeSurface('primary', e.target.value)}
                placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.primary}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label>正文色 (--foreground)</Label>
              <Input
                value={form.themeCustomSurface.foreground}
                onChange={(e) => patchThemeSurface('foreground', e.target.value)}
                placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.foreground}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label>次级底色 (--secondary)</Label>
              <Input
                value={form.themeCustomSurface.secondary}
                onChange={(e) => patchThemeSurface('secondary', e.target.value)}
                placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.secondary}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label>强调色 (--accent)</Label>
              <Input
                value={form.themeCustomSurface.accent}
                onChange={(e) => patchThemeSurface('accent', e.target.value)}
                placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.accent}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label>卡片底色 (--card)</Label>
              <Input
                value={form.themeCustomSurface.card}
                onChange={(e) => patchThemeSurface('card', e.target.value)}
                placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.card}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label>边框 (--border)</Label>
              <Input
                value={form.themeCustomSurface.border}
                onChange={(e) => patchThemeSurface('border', e.target.value)}
                placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.border}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label>弱化底色 (--muted)</Label>
              <Input
                value={form.themeCustomSurface.muted}
                onChange={(e) => patchThemeSurface('muted', e.target.value)}
                placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.muted}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label>次要文字 (--muted-foreground)</Label>
              <Input
                value={form.themeCustomSurface.mutedForeground}
                onChange={(e) => patchThemeSurface('mutedForeground', e.target.value)}
                placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.mutedForeground}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label>在线强调 (--online)</Label>
              <Input
                value={form.themeCustomSurface.online}
                onChange={(e) => patchThemeSurface('online', e.target.value)}
                placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.online}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>全局圆角 (--radius)</Label>
              <Input
                value={form.themeCustomSurface.radius}
                onChange={(e) => patchThemeSurface('radius', e.target.value)}
                placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.radius}
                className="font-mono text-xs max-w-xs"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>整页 background（body）</Label>
            <p className="text-xs text-muted-foreground leading-relaxed">
              注入为 <code className="rounded bg-muted px-1">body</code> 的{' '}
              <code className="rounded bg-muted px-1">background:</code> 简写（渐变、
              <code className="rounded bg-muted px-1">url()</code>、多图层）。与上一项「页面底色」独立；留空则不写，页面仍只用令牌上的{' '}
              <code className="rounded bg-muted px-1">background-color</code>。
              若未关闭下方的动效渐变层，<code className="rounded bg-muted px-1">.animated-bg</code> 仍会铺在全屏最底层之上，可能挡住你在这里设的图/渐变。
            </p>
            <textarea
              rows={4}
              value={form.themeCustomSurface.bodyBackground}
              onChange={(e) => patchThemeSurface('bodyBackground', e.target.value)}
              placeholder='e.g. url("https://…") center/cover no-repeat, linear-gradient(168deg, oklch(0.98 0.01 82), oklch(0.94 0.02 78))'
              className="w-full px-3 py-2 border rounded-md bg-background text-xs font-mono leading-relaxed"
            />
          </div>
          <div className="space-y-2">
            <Label>动效背景层 (.animated-bg)</Label>
            <p className="text-xs text-muted-foreground leading-relaxed">
              固定全屏、在正文后面；留空时使用下方三组默认颜色生成的首页渐变。只想让「页面底色」或「整页 background」露出来请勾选下一项。
            </p>
            <Label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.themeCustomSurface.transparentAnimatedBg}
                onChange={(e) => patchThemeSurface('transparentAnimatedBg', e.target.checked)}
              />
              <span className="text-sm">关闭动效渐变层（本层透明，只见页面底色 / body 背景）</span>
            </Label>
            <textarea
              rows={5}
              value={form.themeCustomSurface.animatedBg}
              onChange={(e) => patchThemeSurface('animatedBg', e.target.value)}
              placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.animatedBg}
              disabled={form.themeCustomSurface.transparentAnimatedBg}
              className="w-full px-3 py-2 border rounded-md bg-background text-xs font-mono leading-relaxed disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>默认动效色 1</Label>
              <Input
                value={form.themeCustomSurface.animatedBgTint1}
                onChange={(e) => patchThemeSurface('animatedBgTint1', e.target.value)}
                placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.animatedBgTint1}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label>默认动效色 2</Label>
              <Input
                value={form.themeCustomSurface.animatedBgTint2}
                onChange={(e) => patchThemeSurface('animatedBgTint2', e.target.value)}
                placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.animatedBgTint2}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label>默认动效色 3</Label>
              <Input
                value={form.themeCustomSurface.animatedBgTint3}
                onChange={(e) => patchThemeSurface('animatedBgTint3', e.target.value)}
                placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.animatedBgTint3}
                className="font-mono text-xs"
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>浮动光斑 1</Label>
              <Input
                value={form.themeCustomSurface.floatingOrbColor1}
                onChange={(e) => patchThemeSurface('floatingOrbColor1', e.target.value)}
                placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.floatingOrbColor1}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label>浮动光斑 2</Label>
              <Input
                value={form.themeCustomSurface.floatingOrbColor2}
                onChange={(e) => patchThemeSurface('floatingOrbColor2', e.target.value)}
                placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.floatingOrbColor2}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label>浮动光斑 3</Label>
              <Input
                value={form.themeCustomSurface.floatingOrbColor3}
                onChange={(e) => patchThemeSurface('floatingOrbColor3', e.target.value)}
                placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.floatingOrbColor3}
                className="font-mono text-xs"
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>首页卡片叠层色</Label>
              <Input
                value={form.themeCustomSurface.homeCardOverlay}
                onChange={(e) => patchThemeSurface('homeCardOverlay', e.target.value)}
                placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.homeCardOverlay}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label>首页卡片暗色叠层</Label>
              <Input
                value={form.themeCustomSurface.homeCardOverlayDark}
                onChange={(e) => patchThemeSurface('homeCardOverlayDark', e.target.value)}
                placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.homeCardOverlayDark}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>首页卡片内高光</Label>
              <Input
                value={form.themeCustomSurface.homeCardInsetHighlight}
                onChange={(e) => patchThemeSurface('homeCardInsetHighlight', e.target.value)}
                placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.homeCardInsetHighlight}
                className="font-mono text-xs max-w-xl"
              />
            </div>
          </div>
          <Label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.themeCustomSurface.hideFloatingOrbs}
              onChange={(e) => patchThemeSurface('hideFloatingOrbs', e.target.checked)}
            />
            <span className="text-sm">隐藏浮动光斑（更干净的静态渐变背景）</span>
          </Label>

          {/* MCP 主题工具已移除：改为 Skills 调试通道 */}
        </div>
      ) : null}

      <div className="space-y-2">
        <Label>自定义 CSS 覆写（主界面）</Label>
        <textarea
          rows={8}
          value={form.customCss}
          onChange={(e) => patch('customCss', e.target.value)}
          className="w-full px-3 py-2 border rounded-md bg-background text-sm font-mono"
          placeholder="示例：:root { --primary: oklch(0.5 0.2 30); }"
        />
        <p className="text-xs text-muted-foreground">
          保存后会注入页面并覆盖默认样式，可用于快速主题定制。
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/10 px-4 py-3">
        <div className="space-y-0.5 min-w-0">
          <Label htmlFor="global-mouse-tilt" className="font-normal cursor-pointer">
            全站页面视差倾斜
          </Label>
          <p className="text-xs text-muted-foreground leading-relaxed">
            开启后整页随鼠标轻微 3D 倾斜；默认关闭。后台路由不受此影响；系统「减少动效」时自动启用。
          </p>
        </div>
        <Switch
          id="global-mouse-tilt"
          checked={form.globalMouseTiltEnabled}
          onCheckedChange={(v) => patch('globalMouseTiltEnabled', v)}
          className="shrink-0"
        />
      </div>

      {form.globalMouseTiltEnabled ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/10 px-4 py-3">
          <div className="space-y-0.5 min-w-0">
            <Label htmlFor="global-mouse-tilt-gyro" className="font-normal cursor-pointer">
              支持检测陀螺仪晃动
            </Label>
            <p className="text-xs text-muted-foreground leading-relaxed">
              开启后在支持的移动设备上使用陀螺仪/设备方向驱动页面倾斜（可能需要系统权限）；不支持或未授权时会自动回退。
            </p>
          </div>
          <Switch
            id="global-mouse-tilt-gyro"
            checked={form.globalMouseTiltGyroEnabled}
            onCheckedChange={(v) => patch('globalMouseTiltGyroEnabled', v)}
            className="shrink-0"
          />
        </div>
      ) : null}

      {/* Profile avatar online ring/dot accent; empty = theme --online */}
      <div className="space-y-2">
        <Label htmlFor="profile-online-accent">头像在线态强调色</Label>
        <p className="text-xs text-muted-foreground">
          留空则使用当前主题自带的在线颜色。仅影响首页头像圆环与右下角在线点。
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            id="profile-online-accent"
            type="color"
            className="h-9 w-14 cursor-pointer rounded-md border border-input bg-background p-1 shadow-xs"
            value={form.profileOnlineAccentColor || '#22C55E'}
            onChange={(e) => patch('profileOnlineAccentColor', e.target.value.toUpperCase())}
            aria-label="Pick profile online accent color"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => patch('profileOnlineAccentColor', '')}
          >
            使用主题默认
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/10 px-4 py-3">
        <div className="space-y-0.5 min-w-0">
          <Label htmlFor="profile-online-pulse" className="font-normal cursor-pointer">
            在线状态呼吸灯
          </Label>
          <p className="text-xs text-muted-foreground leading-relaxed">
            开启时首页头像右下角在线点为呼吸动画；关闭后为静态实心点。系统「减少动效」时浏览器可能仍会减弱动画。
          </p>
        </div>
        <Switch
          id="profile-online-pulse"
          checked={form.profileOnlinePulseEnabled}
          onCheckedChange={(v) => patch('profileOnlinePulseEnabled', v)}
          className="shrink-0"
        />
      </div>

      <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/10 px-4 py-3">
        <div className="space-y-0.5 min-w-0">
          <Label htmlFor="hide-activity-media" className="font-normal cursor-pointer">
            不显示媒体播放
          </Label>
          <p className="text-xs text-muted-foreground leading-relaxed">
            开启后首页「当前状态」卡片不再展示正在播放的曲目与歌手（上报数据仍会保存）。
          </p>
        </div>
        <Switch
          id="hide-activity-media"
          checked={form.hideActivityMedia}
          onCheckedChange={(v) => patch('hideActivityMedia', v)}
          className="shrink-0"
        />
      </div>

      <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/10 px-4 py-3">
        <div className="space-y-0.5 min-w-0">
          <Label htmlFor="activity-reject-lockapp-sleep" className="font-normal cursor-pointer">
            休眠视作离线（拒绝 LockApp 进程上报）
          </Label>
          <p className="text-xs text-muted-foreground leading-relaxed">
            开启后，若上报的进程名为 LockApp 上报程序（如 LockApp.exe），服务端将拒绝写入并不更新设备最后在线时间。
          </p>
        </div>
        <Switch
          id="activity-reject-lockapp-sleep"
          checked={form.activityRejectLockappSleep}
          onCheckedChange={(v) => patch('activityRejectLockappSleep', v)}
          className="shrink-0"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="display-timezone">显示时区</Label>
        <p className="text-xs text-muted-foreground">
          用于显示时间的时区设置，默认为中国标准时间 (GMT+8)。
        </p>
        <Select
          value={form.displayTimezone}
                onValueChange={(v) => patch('displayTimezone', v)}
        >
          <SelectTrigger id="display-timezone" className="w-full max-w-xs">
            <SelectValue placeholder="选择时区" />
          </SelectTrigger>
          <SelectContent>
            {TIMEZONE_OPTIONS.map((tz) => (
              <SelectItem key={tz.value} value={tz.value}>
                {tz.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        <Label htmlFor="activity-update-mode">状态更新模式</Label>
        <p className="text-xs text-muted-foreground">
          选择用于获取活动状态更新的方式。不同模式在实时性和资源消耗之间有所权衡。
        </p>
        <RadioGroup
          value={form.activityUpdateMode}
          onValueChange={(v) => patch('activityUpdateMode', v as ActivityUpdateMode)}
          className="space-y-3"
        >
          {ACTIVITY_UPDATE_MODE_OPTIONS.map((option) => (
            <div key={option.value} className="flex items-start space-x-3">
              <RadioGroupItem value={option.value} id={`update-mode-${option.value}`} className="mt-1" />
              <div className="flex-1 space-y-1">
                <Label htmlFor={`update-mode-${option.value}`} className="font-medium cursor-pointer">
                  {option.label}
                </Label>
                <p className="text-xs text-muted-foreground">{option.description}</p>
                {option.warning && (
                  <div className="rounded-md bg-amber-500/10 border border-amber-500/20 px-3 py-2 mt-2">
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      <span className="font-semibold">注意：</span>{option.warning}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </RadioGroup>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/10 px-4 py-3">
        <div className="space-y-0.5 min-w-0">
          <Label htmlFor="use-nosql-as-cache-redis" className="font-normal cursor-pointer">
            UseNoSQLAsCache(Redis) - 使用 Redis 缓存
          </Label>
          <p className="text-xs text-muted-foreground leading-relaxed">
            开启后，活动流、站点配置、JWT 密钥缓存、限流、设备与 API Token 校验等优先走 Redis；关闭后上述用途均不走 Redis。未配置或不可用时自动回退，不会中断服务。
          </p>
          {redisCacheServerlessForced && (
            <div className="rounded-md bg-amber-500/10 border border-amber-500/20 px-3 py-2 mt-2">
              <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                检测到 Serverless 环境（Vercel）：此项默认强制为开且无法在此关闭；若未配置 REDIS_URL，相关逻辑会跳过 Redis 并回退到数据库/内存。
              </p>
            </div>
          )}
        </div>
        <Switch
          id="use-nosql-as-cache-redis"
          checked={form.useNoSqlAsCacheRedis}
          onCheckedChange={(v) => patch('useNoSqlAsCacheRedis', v)}
          disabled={redisCacheServerlessForced}
          className="shrink-0"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="redis-cache-ttl-seconds">Redis 缓存 TTL（秒）</Label>
        <Input
          id="redis-cache-ttl-seconds"
          type="number"
          onWheel={(e) => e.currentTarget.blur()}
          min={1}
          max={REDIS_ACTIVITY_FEED_CACHE_TTL_MAX_SECONDS}
          value={form.redisCacheTtlSeconds}
          onChange={(e) =>
            patch(
              'redisCacheTtlSeconds',
              Number(e.target.value || REDIS_ACTIVITY_FEED_CACHE_TTL_DEFAULT_SECONDS),
            )
          }
        />
        <p className="text-xs text-muted-foreground">
          聚合活动流（含数据库活动）在 Redis 中的缓存秒数。默认 3600（1 小时）；更短更实时，更长更省读库。
        </p>
      </div>

      {/* Steam 状态设置 */}
      <div className="space-y-4 rounded-lg border border-border p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label htmlFor="steam-enabled" className="text-base font-medium">Steam 状态</Label>
            <p className="text-xs text-muted-foreground">
              在此配置全站 Steam 账号与 API Key；在「设备管理」中为需要展示的设备打开「状态卡片显示 Steam
              正在游玩」后，该设备在线且 Steam 回报在玩游戏时，会在首页状态卡片上与音乐信息一并显示。
            </p>
          </div>
          <Switch
            id="steam-enabled"
            checked={form.steamEnabled}
            onCheckedChange={(v) => patch('steamEnabled', v)}
          />
        </div>
        
        {form.steamEnabled && (
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="space-y-2">
              <Label htmlFor="steam-id">Steam ID (64-bit)</Label>
              <Input
                id="steam-id"
                value={form.steamId}
                onChange={(e) => patch('steamId', e.target.value)}
                placeholder="例如: 76561198000000000"
              />
              <p className="text-xs text-muted-foreground">
                全站共用的 Steam 64-bit ID（非按设备填写），可在
                <a
                  href="https://steamid.io/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline mx-1"
                >
                  steamid.io
                </a>
                查询。
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="steam-api-key">Steam Web API Key（留空则不修改已保存的值）</Label>
              <Input
                id="steam-api-key"
                autoComplete="off"
                value={form.steamApiKey}
                onChange={(e) => patch('steamApiKey', e.target.value)}
                placeholder="在 Steam 开发者申请；也可使用环境变量 STEAM_API_KEY 作为后备"
              />
              <p className="text-xs text-muted-foreground">
                在{' '}
                <a
                  href="https://steamcommunity.com/dev/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  steamcommunity.com/dev/apikey
                </a>{' '}
                申请。保存后仅服务端使用，不会下发到前台。
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>历史窗口（分钟）</Label>
        <Input
          type="number"
          onWheel={(e) => e.currentTarget.blur()}
          min={SITE_CONFIG_HISTORY_WINDOW_MIN_MINUTES}
          max={SITE_CONFIG_HISTORY_WINDOW_MAX_MINUTES}
          value={form.historyWindowMinutes}
          onChange={(e) =>
            patch(
              'historyWindowMinutes',
              Number(e.target.value || SITE_CONFIG_HISTORY_WINDOW_DEFAULT_MINUTES),
            )
          }
        />
      </div>
      <div className="space-y-2">
        <Label>进程超时判定（秒）</Label>
        <Input
          type="number"
          onWheel={(e) => e.currentTarget.blur()}
          min={SITE_CONFIG_PROCESS_STALE_MIN_SECONDS}
          max={SITE_CONFIG_PROCESS_STALE_MAX_SECONDS}
          value={form.processStaleSeconds}
          onChange={(e) =>
            patch(
              'processStaleSeconds',
              Number(e.target.value || SITE_CONFIG_PROCESS_STALE_DEFAULT_SECONDS),
            )
          }
        />
        <p className="text-xs text-muted-foreground">
          超过该时长仍未收到该进程新活动时，将自动判定为已结束。默认{' '}
          {SITE_CONFIG_PROCESS_STALE_DEFAULT_SECONDS} 秒。
        </p>
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.autoAcceptNewDevices}
            onChange={(e) => patch('autoAcceptNewDevices', e.target.checked)}
          />
          自动接收本地新设备（设备身份牌）
        </Label>
        <p className="text-xs text-muted-foreground">
          关闭后，未授权设备身份牌首次上报会进入待审核状态，需要在“设备管理”中手动通过。
        </p>
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.inspirationDeviceRestrictionEnabled}
            onChange={(e) => patch('inspirationDeviceRestrictionEnabled', e.target.checked)}
          />
          仅允许所选设备通过 API Token 提交「灵感随想录」
        </Label>
        <p className="text-xs text-muted-foreground">
          关闭时：任意已绑定且激活、并使用同一 Token 的设备均可调用随想录接口。开启后：仅下方勾选的设备可提交；客户端请求需携带请求头{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-[11px]">X-Device-Key</code>
          （值为该设备在后台的「设备身份牌」），或在 JSON 中传{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-[11px]">generatedHashKey</code>
          。管理员在后台网页里提交不受此限制。
        </p>
        {form.inspirationDeviceRestrictionEnabled && (
          <div className="max-h-52 space-y-2 overflow-y-auto rounded-md border bg-background/50 p-3">
            {inspirationDevices.length === 0 ? (
              <p className="text-xs text-muted-foreground">暂无设备，请先在「设备管理」中添加。</p>
            ) : (
              inspirationDevices.map((d) => (
                <label key={d.id} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.inspirationAllowedDeviceHashes.includes(d.generatedHashKey)}
                    onChange={(e) => {
                      const key = d.generatedHashKey
                      const checked = e.target.checked
                      const next = checked
                        ? Array.from(new Set([...form.inspirationAllowedDeviceHashes, key]))
                        : form.inspirationAllowedDeviceHashes.filter((k) => k !== key)
                      patch('inspirationAllowedDeviceHashes', next)
                    }}
                  />
                  <span className="min-w-0 flex-1 truncate font-medium">{d.displayName}</span>
                  <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                    {d.generatedHashKey.slice(0, 10)}…
                  </span>
                  {d.status !== 'active' ? (
                    <span className="shrink-0 text-xs text-amber-600">({d.status})</span>
                  ) : null}
                </label>
              ))
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 rounded-lg border border-border/60 bg-card/40 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <Label className="text-base">应用匹配文案规则</Label>
            <p className="text-xs text-muted-foreground">已保存 {rulesTotal} 条</p>
          </div>
          <Button type="button" variant="secondary" className="shrink-0" onClick={() => setDialogAppRulesOpen(true)}>
            在弹窗中编辑
          </Button>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-md border border-border/50 bg-background/40 px-3 py-2.5">
          <div className="space-y-0.5 min-w-0">
            <Label htmlFor="app-rule-show-process" className="font-normal cursor-pointer">
              命中规则时显示进程名
            </Label>
            <p className="text-xs text-muted-foreground leading-relaxed">
              开启后为「文案 | 进程名」；关闭则仅显示规则文案（仍隐藏原标题）。
            </p>
          </div>
          <Switch
            id="app-rule-show-process"
            checked={form.appMessageRulesShowProcessName}
            onCheckedChange={(v) => patch('appMessageRulesShowProcessName', v)}
            className="shrink-0"
          />
        </div>
        {rulesTotal > 0 ? (
          <div className="space-y-2 rounded-md border border-border/50 bg-background/35 px-3 py-3">
            <p className="text-xs text-muted-foreground">规则预览（前 3 条）</p>
            <ul className="space-y-2">
              {form.appMessageRules.slice(0, 3).map((rule, idx) => (
                <li key={`${rule.match}-${idx}`} className="rounded-md border border-border/40 bg-background/55 px-3 py-2">
                  <p className="text-xs font-medium text-foreground/80 break-all font-mono">{rule.match || '未填写 match'}</p>
                  <p className="mt-1 text-sm text-muted-foreground break-words">{rule.text || '未填写 text'}</p>
                </li>
              ))}
            </ul>
            {rulesTotal > 3 ? <p className="text-xs text-muted-foreground">其余 {rulesTotal - 3} 条可在弹窗中继续查看和编辑。</p> : null}
          </div>
        ) : null}
      </div>

      <Dialog open={dialogAppRulesOpen} onOpenChange={setDialogAppRulesOpen}>
        <DialogContent
          className="flex max-h-[min(90vh,56rem)] w-[calc(100vw-1.5rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
          showCloseButton
        >
          <DialogHeader className="shrink-0 space-y-1 border-b px-6 py-4 text-left">
            <DialogTitle>应用匹配文案规则</DialogTitle>
            <DialogDescription>
              match 为进程/应用名，text 为展示文案；支持 {'{process}'}、{'{title}'} 占位符。
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <div className="space-y-3">
              {form.appMessageRules.length === 0 ? (
                <p className="text-xs text-muted-foreground">暂无规则</p>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">已有规则（分页浏览）</p>
                  {form.appMessageRules.slice(rulesStart, rulesStart + SETTINGS_RULES_PAGE_SIZE).map((rule, localIdx) => {
                    const idx = rulesStart + localIdx
                    return (
                      <div key={idx} className="space-y-3 rounded-md border bg-background/50 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs text-muted-foreground">
                            规则 {idx + 1} / 共 {rulesTotal} 条
                          </p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              patch(
                                'appMessageRules',
                                form.appMessageRules.filter((_, i) => i !== idx),
                              )
                            }
                          >
                            删除
                          </Button>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`rule-match-${idx}`}>match（进程/应用名）</Label>
                          <Combobox
                            items={form.captureReportedAppsEnabled ? historyApps : []}
                            inputValue={rule.match}
                            onInputValueChange={(v) => {
                              const next = [...form.appMessageRules]
                              next[idx] = { ...next[idx], match: v }
                              patch('appMessageRules', next)
                            }}
                            onValueChange={(v) => {
                              const next = [...form.appMessageRules]
                              next[idx] = { ...next[idx], match: String(v ?? '') }
                              patch('appMessageRules', next)
                            }}
                          >
                            <ComboboxInput
                              id={`rule-match-${idx}`}
                              placeholder="例如：WindowsTerminal.exe"
                              showClear={false}
                            />
                            <ComboboxContent>
                              <ComboboxEmpty>
                                {form.captureReportedAppsEnabled ? '无匹配历史应用' : '未启用历史应用记录'}
                              </ComboboxEmpty>
                              <ComboboxList>
                                {(item) => (
                                  <ComboboxItem key={item} value={item}>
                                    {item}
                                  </ComboboxItem>
                                )}
                              </ComboboxList>
                            </ComboboxContent>
                          </Combobox>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`rule-text-${idx}`}>text（替换文案）</Label>
                          <textarea
                            id={`rule-text-${idx}`}
                            rows={3}
                            value={rule.text}
                            onChange={(e) => {
                              const next = [...form.appMessageRules]
                              next[idx] = { ...next[idx], text: e.target.value }
                              patch('appMessageRules', next)
                            }}
                            className="w-full rounded-md border bg-background px-3 py-2 font-mono text-sm"
                            placeholder="例如：正在编码：{title}"
                          />
                        </div>
                      </div>
                    )
                  })}
                  <ListPaginationBar
                    page={rulesListPage}
                    pageSize={SETTINGS_RULES_PAGE_SIZE}
                    total={rulesTotal}
                    onPageChange={setRulesListPage}
                  />
                </div>
              )}

              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const next = [...form.appMessageRules, { match: '', text: '' }]
                  patch('appMessageRules', next)
                  const last = listMaxPage(next.length, SETTINGS_RULES_PAGE_SIZE)
                  setRulesListPage(last)
                }}
              >
                添加规则
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              示例：match 为 `WindowsTerminal.exe`，text 为 {'正在编码：{title}'}。
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card/40 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <Label className="text-base">应用显示筛选</Label>
          <p className="text-xs text-muted-foreground">
            {form.appFilterMode === 'blacklist' ? '黑名单' : '白名单'}模式 · 黑 {form.appBlacklist.length} / 白{' '}
            {form.appWhitelist.length} 条
          </p>
        </div>
        <Button type="button" variant="secondary" className="shrink-0" onClick={() => setDialogAppFilterOpen(true)}>
          在弹窗中编辑
        </Button>
      </div>

      <Dialog open={dialogAppFilterOpen} onOpenChange={setDialogAppFilterOpen}>
        <DialogContent
          className="flex max-h-[min(90vh,56rem)] w-[calc(100vw-1.5rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
          showCloseButton
        >
          <DialogHeader className="shrink-0 space-y-1 border-b px-6 py-4 text-left">
            <DialogTitle>应用显示筛选</DialogTitle>
            <DialogDescription>选择黑名单或白名单，并维护应用名列表（不区分大小写）。</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <div className="space-y-4 rounded-lg border border-border/60 bg-card/30 p-4">
        <RadioGroup
          value={form.appFilterMode}
          onValueChange={(v) => patch('appFilterMode', v as 'blacklist' | 'whitelist')}
          className="gap-3"
        >
          <div className="flex items-start gap-3">
            <RadioGroupItem value="blacklist" id="filter-blacklist" className="mt-0.5" />
            <div className="space-y-1">
              <Label htmlFor="filter-blacklist" className="font-medium cursor-pointer">
                黑名单模式
              </Label>
              <p className="text-xs text-muted-foreground">列表中的应用将从当前状态与历史记录中隐藏。</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <RadioGroupItem value="whitelist" id="filter-whitelist" className="mt-0.5" />
            <div className="space-y-1">
              <Label htmlFor="filter-whitelist" className="font-medium cursor-pointer">
                白名单模式
              </Label>
              <p className="text-xs text-muted-foreground">
                仅列表中的应用会显示；白名单为空时不展示任何活动记录。
              </p>
            </div>
          </div>
        </RadioGroup>

        {form.appFilterMode === 'blacklist' ? (
          <div className="space-y-3 pt-2 border-t border-border/50">
            <Label htmlFor="blacklist-input">黑名单应用名</Label>
            <p className="text-xs text-muted-foreground">不区分大小写，每行添加一个应用名。</p>
            <div className="flex flex-wrap items-center gap-2">
              <Combobox
                items={form.captureReportedAppsEnabled ? historyApps : []}
                inputValue={blacklistInput}
                onInputValueChange={setBlacklistInput}
                onValueChange={(v) => setBlacklistInput(String(v ?? ''))}
              >
                <ComboboxInput id="blacklist-input" placeholder="例如：WeChat.exe" showClear={false} />
                <ComboboxContent>
                  <ComboboxEmpty>
                    {form.captureReportedAppsEnabled ? '无匹配历史应用' : '未启用历史应用记录'}
                  </ComboboxEmpty>
                  <ComboboxList>
                    {(item) => (
                      <ComboboxItem key={item} value={item}>
                        {item}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
              <Button
                type="button"
                className="shrink-0"
                onClick={() => {
                  const value = blacklistInput.trim()
                  if (!value) return
                  const exists = form.appBlacklist.some((x) => x.toLowerCase() === value.toLowerCase())
                  if (exists) return
                  const next = [...form.appBlacklist, value]
                  patch('appBlacklist', next)
                  setBlacklistInput('')
                  setBlacklistListPage(listMaxPage(next.length, SETTINGS_APP_LIST_PAGE_SIZE))
                }}
              >
                添加
              </Button>
            </div>

            {form.appBlacklist.length === 0 ? (
              <p className="text-xs text-muted-foreground">暂无黑名单条目</p>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">已有条目（分页）</p>
                <ul className="space-y-3">
                  {form.appBlacklist
                    .slice(blStart, blStart + SETTINGS_APP_LIST_PAGE_SIZE)
                    .map((app, localIdx) => {
                      const idx = blStart + localIdx
                      return (
                        <li
                          key={`${app}-${idx}`}
                          className="flex items-center justify-between gap-3 rounded-md border bg-background/50 px-3 py-2.5"
                        >
                          <span className="text-sm text-foreground break-all">{app}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="shrink-0"
                            onClick={() =>
                              patch(
                                'appBlacklist',
                                form.appBlacklist.filter((_, i) => i !== idx),
                              )
                            }
                          >
                            删除
                          </Button>
                        </li>
                      )
                    })}
                </ul>
                <ListPaginationBar
                  page={blacklistListPage}
                  pageSize={SETTINGS_APP_LIST_PAGE_SIZE}
                  total={blTotal}
                  onPageChange={setBlacklistListPage}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3 pt-2 border-t border-border/50">
            <Label htmlFor="whitelist-input">白名单应用名</Label>
            <p className="text-xs text-muted-foreground">不区分大小写；仅这些应用会出现在前台。</p>
            <div className="flex flex-wrap items-center gap-2">
              <Combobox
                items={form.captureReportedAppsEnabled ? historyApps : []}
                inputValue={whitelistInput}
                onInputValueChange={setWhitelistInput}
                onValueChange={(v) => setWhitelistInput(String(v ?? ''))}
              >
                <ComboboxInput id="whitelist-input" placeholder="例如：Code.exe" showClear={false} />
                <ComboboxContent>
                  <ComboboxEmpty>
                    {form.captureReportedAppsEnabled ? '无匹配历史应用' : '未启用历史应用记录'}
                  </ComboboxEmpty>
                  <ComboboxList>
                    {(item) => (
                      <ComboboxItem key={item} value={item}>
                        {item}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
              <Button
                type="button"
                className="shrink-0"
                onClick={() => {
                  const value = whitelistInput.trim()
                  if (!value) return
                  const exists = form.appWhitelist.some((x) => x.toLowerCase() === value.toLowerCase())
                  if (exists) return
                  const next = [...form.appWhitelist, value]
                  patch('appWhitelist', next)
                  setWhitelistInput('')
                  setWhitelistListPage(listMaxPage(next.length, SETTINGS_APP_LIST_PAGE_SIZE))
                }}
              >
                添加
              </Button>
            </div>

            {form.appWhitelist.length === 0 ? (
              <p className="text-xs text-muted-foreground">白名单为空：前台不显示任何活动</p>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">已有条目（分页）</p>
                <ul className="space-y-3">
                  {form.appWhitelist
                    .slice(wlStart, wlStart + SETTINGS_APP_LIST_PAGE_SIZE)
                    .map((app, localIdx) => {
                      const idx = wlStart + localIdx
                      return (
                        <li
                          key={`${app}-${idx}`}
                          className="flex items-center justify-between gap-3 rounded-md border bg-background/50 px-3 py-2.5"
                        >
                          <span className="text-sm text-foreground break-all">{app}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="shrink-0"
                            onClick={() =>
                              patch(
                                'appWhitelist',
                                form.appWhitelist.filter((_, i) => i !== idx),
                              )
                            }
                          >
                            删除
                          </Button>
                        </li>
                      )
                    })}
                </ul>
                <ListPaginationBar
                  page={whitelistListPage}
                  pageSize={SETTINGS_APP_LIST_PAGE_SIZE}
                  total={wlTotal}
                  onPageChange={setWhitelistListPage}
                />
              </div>
            )}
          </div>
        )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card/40 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <Label className="text-base">仅显示应用名</Label>
          <p className="text-xs text-muted-foreground">已配置 {noTotal} 个应用</p>
        </div>
        <Button type="button" variant="secondary" className="shrink-0" onClick={() => setDialogNameOnlyOpen(true)}>
          在弹窗中编辑
        </Button>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card/40 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <Label className="text-base">媒体来源屏蔽规则（play_source）</Label>
          <p className="text-xs text-muted-foreground">已配置 {msTotal} 条</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            关闭「保存上报行为的应用记录」后不会再新增历史记录，但会保留已保存的历史数据。
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          className="shrink-0"
          onClick={() => setDialogMediaSourceOpen(true)}
        >
          在弹窗中编辑
        </Button>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/10 px-4 py-3">
        <div className="space-y-0.5 min-w-0">
          <Label htmlFor="capture-reported-apps" className="font-normal cursor-pointer">
            保存上报行为的应用记录（用于规则选择/导出）
          </Label>
          <p className="text-xs text-muted-foreground leading-relaxed">
            关闭后不会再新增历史记录，但会保留已保存的历史数据。
          </p>
        </div>
        <Switch
          id="capture-reported-apps"
          checked={form.captureReportedAppsEnabled}
          onCheckedChange={(v) => patch('captureReportedAppsEnabled', v)}
          className="shrink-0"
        />
      </div>

      <Dialog open={dialogMediaSourceOpen} onOpenChange={setDialogMediaSourceOpen}>
        <DialogContent
          className="flex max-h-[min(90vh,48rem)] w-[calc(100vw-1.5rem)] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
          showCloseButton
        >
          <DialogHeader className="shrink-0 space-y-1 border-b px-6 py-4 text-left">
            <DialogTitle>媒体来源屏蔽规则</DialogTitle>
            <DialogDescription>
              当上报的 <code className="rounded bg-muted px-1">metadata.play_source</code> 命中时，将隐藏该条活动的媒体信息（仅移除 metadata.media）。
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">输入来源值（建议小写）</p>
              <div className="flex flex-wrap items-center gap-2">
                <Combobox
                  items={form.mediaPlaySourceBlocklist}
                  inputValue={mediaSourceInput}
                  onInputValueChange={setMediaSourceInput}
                  onValueChange={(v) => setMediaSourceInput(String(v ?? ''))}
                >
                  <ComboboxInput
                    id="mediaSource-input"
                    placeholder="例如：system_media"
                    className="flex-1 min-w-[240px] font-mono text-xs"
                    showClear={false}
                  />
                  <ComboboxContent>
                    <ComboboxEmpty>无历史条目</ComboboxEmpty>
                    <ComboboxList>
                      {(item) => (
                        <ComboboxItem key={item} value={item}>
                          {item}
                        </ComboboxItem>
                      )}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
                <Button
                  type="button"
                  className="shrink-0"
                  onClick={() => {
                    const value = mediaSourceInput.trim().toLowerCase()
                    if (!value) return
                    const exists = form.mediaPlaySourceBlocklist.some((x) => x.toLowerCase() === value)
                    if (exists) return
                    const next = [...form.mediaPlaySourceBlocklist, value]
                    patch('mediaPlaySourceBlocklist', next)
                    setMediaSourceInput('')
                    setMediaSourceListPage(listMaxPage(next.length, SETTINGS_APP_LIST_PAGE_SIZE))
                  }}
                >
                  添加
                </Button>
              </div>

              {form.mediaPlaySourceBlocklist.length === 0 ? (
                <p className="text-xs text-muted-foreground">暂无屏蔽规则</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">已有条目（分页）</p>
                  <ul className="space-y-3">
                    {form.mediaPlaySourceBlocklist
                      .slice(msStart, msStart + SETTINGS_APP_LIST_PAGE_SIZE)
                      .map((src, localIdx) => {
                        const idx = msStart + localIdx
                        return (
                          <li
                            key={`${src}-${idx}`}
                            className="flex items-center justify-between gap-3 rounded-md border bg-background/50 px-3 py-2.5"
                          >
                            <span className="text-sm text-foreground break-all font-mono">{src}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="shrink-0"
                              onClick={() =>
                                patch(
                                  'mediaPlaySourceBlocklist',
                                  form.mediaPlaySourceBlocklist.filter((_, i) => i !== idx),
                                )
                              }
                            >
                              删除
                            </Button>
                          </li>
                        )
                      })}
                  </ul>
                  <ListPaginationBar
                    page={mediaSourceListPage}
                    pageSize={SETTINGS_APP_LIST_PAGE_SIZE}
                    total={msTotal}
                    onPageChange={setMediaSourceListPage}
                  />
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogNameOnlyOpen} onOpenChange={setDialogNameOnlyOpen}>
        <DialogContent
          className="flex max-h-[min(90vh,48rem)] w-[calc(100vw-1.5rem)] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
          showCloseButton
        >
          <DialogHeader className="shrink-0 space-y-1 border-b px-6 py-4 text-left">
            <DialogTitle>仅显示应用名</DialogTitle>
            <DialogDescription>
              命中后只显示应用名，不显示窗口标题等详细内容（不区分大小写）。
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">输入应用名（不区分大小写）</p>
              <div className="flex flex-wrap items-center gap-2">
                <Combobox
                  items={form.captureReportedAppsEnabled ? historyApps : []}
                  inputValue={nameOnlyListInput}
                  onInputValueChange={setNameOnlyListInput}
                  onValueChange={(v) => setNameOnlyListInput(String(v ?? ''))}
                >
                  <ComboboxInput id="nameOnly-input" placeholder="例如：Code.exe" showClear={false} />
                  <ComboboxContent>
                    <ComboboxEmpty>
                      {form.captureReportedAppsEnabled ? '无匹配历史应用' : '未启用历史应用记录'}
                    </ComboboxEmpty>
                    <ComboboxList>
                      {(item) => (
                        <ComboboxItem key={item} value={item}>
                          {item}
                        </ComboboxItem>
                      )}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
                <Button
                  type="button"
                  className="shrink-0"
                  onClick={() => {
                    const value = nameOnlyListInput.trim()
                    if (!value) return
                    const exists = form.appNameOnlyList.some((x) => x.toLowerCase() === value.toLowerCase())
                    if (exists) return
                    const next = [...form.appNameOnlyList, value]
                    patch('appNameOnlyList', next)
                    setNameOnlyListInput('')
                    setNameOnlyListPage(listMaxPage(next.length, SETTINGS_APP_LIST_PAGE_SIZE))
                  }}
                >
                  添加
                </Button>
              </div>

              {form.appNameOnlyList.length === 0 ? (
                <p className="text-xs text-muted-foreground">暂无“仅显示应用名”配置</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">已有条目（分页）</p>
                  <ul className="space-y-3">
                    {form.appNameOnlyList
                      .slice(noStart, noStart + SETTINGS_APP_LIST_PAGE_SIZE)
                      .map((app, localIdx) => {
                        const idx = noStart + localIdx
                        return (
                          <li
                            key={`${app}-${idx}`}
                            className="flex items-center justify-between gap-3 rounded-md border bg-background/50 px-3 py-2.5"
                          >
                            <span className="text-sm text-foreground break-all">{app}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="shrink-0"
                              onClick={() =>
                                patch(
                                  'appNameOnlyList',
                                  form.appNameOnlyList.filter((_, i) => i !== idx),
                                )
                              }
                            >
                              删除
                            </Button>
                          </li>
                        )
                      })}
                  </ul>
                  <ListPaginationBar
                    page={nameOnlyListPage}
                    pageSize={SETTINGS_APP_LIST_PAGE_SIZE}
                    total={noTotal}
                    onPageChange={setNameOnlyListPage}
                  />
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="rounded-lg border border-border/60 bg-muted/10 p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="hcaptcha-toggle" className="font-normal cursor-pointer">
            启用 hCaptcha 登录验证
          </Label>
          <Switch
            id="hcaptcha-toggle"
            checked={form.hcaptchaEnabled}
            onCheckedChange={(v) => patch('hcaptchaEnabled', v)}
          />
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          开启后，后台登录页将显示 hCaptcha 人机验证。需前往{' '}
          <a
            href="https://www.hcaptcha.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            hcaptcha.com
          </a>{' '}
          注册并获取 Site Key 和 Secret Key。
        </p>
        {form.hcaptchaEnabled && (
          <div className="space-y-3 pt-1">
            <div className="space-y-2">
              <Label htmlFor="hcaptcha-sitekey">Site Key</Label>
              <Input
                id="hcaptcha-sitekey"
                value={form.hcaptchaSiteKey}
                onChange={(e) => patch('hcaptchaSiteKey', e.target.value)}
                placeholder="10000000-ffff-ffff-ffff-000000000001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hcaptcha-secretkey">Secret Key（留空则不修改已保存的值）</Label>
              <Input
                id="hcaptcha-secretkey"
                value={form.hcaptchaSecretKey}
                onChange={(e) => patch('hcaptchaSecretKey', e.target.value)}
                placeholder="留空则保留之前配置的 Secret Key"
              />
            </div>
          </div>
        )}
      </div>


      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="outline" onClick={() => void copyExportConfig()}>
          一键复制接入配置（Base64）
        </Button>
        <Button type="button" variant="outline" onClick={() => void applyImportConfig()}>
          一键写入配置
        </Button>
        <Button type="button" variant="outline" onClick={() => void exportUsedAppsJson()}>
          导出已使用应用（JSON）
        </Button>
        <Button type="button" variant="outline" onClick={() => void copyRulesJson()}>
          复制规则 JSON
        </Button>
        <Button type="button" variant="outline" onClick={openImportRules}>
          导入规则 JSON
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        「一键写入配置」会尝试从剪贴板读取 Base64，并在弹窗中确认。仅合并导出包中的网页字段到本页表单，不包含 Token；
        写入后请用底部悬浮条保存。
      </p>
        </TabsContent>
      </Tabs>

      <ImageCropDialog
        open={cropDialogOpen}
        onOpenChange={(open) => {
          setCropDialogOpen(open)
          if (!open) {
            setCropSourceUrl((prev) => {
              if (prev) URL.revokeObjectURL(prev)
              return null
            })
          }
        }}
        sourceUrl={cropSourceUrl}
        aspectMode="square"
        outputSize={128}
        title="裁剪头像"
        description="拖动选区或边角调整范围，确认后生成 128×128 头像。"
        onComplete={(dataUrl) => patch('avatarUrl', dataUrl)}
      />
    </div>
    <Dialog open={importConfigDialogOpen} onOpenChange={setImportConfigDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>导入网页配置</DialogTitle>
          <DialogDescription>
            将用导入包中的「网页配置」覆盖当前表单（不含页面锁密码、不含 API Token）。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="import-config-input">Base64 接入配置</Label>
          <Input
            id="import-config-input"
            value={importConfigInput}
            onChange={(e) => setImportConfigInput(e.target.value)}
            placeholder="粘贴「一键复制接入配置」导出的 Base64 全文"
            className="font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">导入时会自动忽略空格与换行。</p>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setImportConfigDialogOpen(false)}
          >
            取消
          </Button>
          <Button type="button" onClick={confirmImportConfig}>
            导入并覆盖网页配置
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={importRulesDialogOpen} onOpenChange={setImportRulesDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>导入规则 JSON</DialogTitle>
          <DialogDescription>
            将覆盖当前表单中的应用规则与媒体来源规则。写入后请点击保存配置。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="import-rules-input">规则 JSON</Label>
          <textarea
            id="import-rules-input"
            rows={10}
            value={importRulesInput}
            onChange={(e) => setImportRulesInput(e.target.value)}
            placeholder='粘贴 JSON（包含 version 与 rules 字段）'
            className="w-full px-3 py-2 border rounded-md bg-background text-xs font-mono leading-relaxed"
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setImportRulesDialogOpen(false)}>
            取消
          </Button>
          <Button type="button" onClick={confirmImportRules}>
            导入并覆盖规则
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <UnsavedChangesBar
      open={webSettingsDirty}
      saving={saving}
      onSave={save}
      onRevert={revertUnsavedWebSettings}
      saveLabel="保存配置"
      revertLabel="撤销"
    />
    </>
  )
}
