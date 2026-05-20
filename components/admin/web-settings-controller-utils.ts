import { uploadImageSource } from '@/components/admin/admin-query-mutations'
import { publicPageFontOptionsFromApi,themeCustomSurfaceFromApi } from '@/components/admin/web-settings-utils'
import {
  REDIS_ACTIVITY_FEED_CACHE_TTL_DEFAULT_SECONDS,
} from '@/constants/activity-api'
import {
  SITE_CONFIG_HISTORY_WINDOW_DEFAULT_MINUTES,
  SITE_CONFIG_PROCESS_STALE_DEFAULT_SECONDS,
  SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_DEFAULT,
  SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_MAX_LEN,
  SITE_CONFIG_SCHEDULE_SLOT_DEFAULT_MINUTES,
} from '@/constants/site-config'
import {
  SITE_SETTINGS_SCHEDULE_CATEGORY_KEYS,
  SITE_SETTINGS_THEME_CATEGORY_KEYS,
} from '@/constants/site-settings'
import { normalizeActivityUpdateMode } from '@/lib/activity-update-mode'
import {
  normalizeAdminThemeColor,
} from '@/lib/admin-theme-color'
import { isRemoteAvatarUrl } from '@/lib/avatar-url'
import { DEFAULT_PAGE_TITLE } from '@/lib/default-page-title'
import { normalizeHitokotoCategories, normalizeHitokotoEncode } from '@/lib/hitokoto'
import { normalizeProfileOnlineAccentColor } from '@/lib/profile-online-accent-color'
import {
  isAllowedSlotMinutes,
  resolveSchedulePeriodTemplate,
  type ScheduleCourse,
} from '@/lib/schedule-courses'
import { resolveScheduleGridByWeekday } from '@/lib/schedule-grid-by-weekday'
import { normalizeSiteIconUrl } from '@/lib/site-icon'
import { omitRecordKeys } from '@/lib/site-settings-record'
import { normalizeStatusCardSettings } from '@/lib/status-card-options'
import { normalizeTimezone } from '@/lib/timezone'
import {
  normalizeTodayStatusBusy,
  normalizeTodayStatusEmoji,
  normalizeTodayStatusExpiresAt,
  normalizeTodayStatusText,
} from '@/lib/today-status'
import type { SiteConfig } from '@/types/web-settings'

export type WebSettingsFormDefaults = {
  currentlyTextDefault: string
  earlierTextDefault: string
}

export function areValuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true
  if (typeof left !== typeof right) return false
  if (left === null || right === null) return false

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) return false
    if (left.length !== right.length) return false
    for (let index = 0; index < left.length; index += 1) {
      if (!areValuesEqual(left[index], right[index])) return false
    }
    return true
  }

  if (typeof left === 'object' && typeof right === 'object') {
    const leftObject = left as Record<string, unknown>
    const rightObject = right as Record<string, unknown>
    const leftKeys = Object.keys(leftObject)
    const rightKeys = Object.keys(rightObject)
    if (leftKeys.length !== rightKeys.length) return false
    for (const key of leftKeys) {
      if (!Object.prototype.hasOwnProperty.call(rightObject, key)) return false
      if (!areValuesEqual(leftObject[key], rightObject[key])) return false
    }
    return true
  }

  return false
}

export function hasKeyDiff(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  for (const key of keys) {
    if (!areValuesEqual(left[key], right[key])) return true
  }
  return false
}

export function normalizeCorePayloadForComparison(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  return omitRecordKeys(
    {
      ...payload,
      hcaptchaSecretKey: '',
      steamApiKey: '',
    },
    [...SITE_SETTINGS_THEME_CATEGORY_KEYS, ...SITE_SETTINGS_SCHEDULE_CATEGORY_KEYS],
  )
}

export function isInlineImageDataUrl(value: unknown): value is string {
  return typeof value === 'string' && /^data:image\//i.test(value.trim())
}

export async function uploadImportedImageSources(
  patch: Partial<SiteConfig>,
): Promise<Partial<SiteConfig>> {
  const next: Partial<SiteConfig> = { ...patch }

  if (isInlineImageDataUrl(next.avatarUrl)) {
    next.avatarUrl = await uploadImageSource(next.avatarUrl, 'site.avatar')
  }
  if (isInlineImageDataUrl(next.siteIconUrl)) {
    next.siteIconUrl = await uploadImageSource(next.siteIconUrl, 'site.icon')
  }
  if (next.themeCustomSurface) {
    const surface = { ...next.themeCustomSurface }
    if (isInlineImageDataUrl(surface.backgroundImageUrl)) {
      surface.backgroundImageUrl = await uploadImageSource(
        surface.backgroundImageUrl,
        'theme.background',
      )
    }
    if (isInlineImageDataUrl(surface.paletteSeedImageUrl)) {
      surface.paletteSeedImageUrl = await uploadImageSource(
        surface.paletteSeedImageUrl,
        'theme.palette-seed',
      )
    }
    surface.backgroundImagePool = await Promise.all(
      surface.backgroundImagePool.map((item, index) =>
        isInlineImageDataUrl(item) ? uploadImageSource(item, `theme.pool.${index}`) : item,
      ),
    )
    next.themeCustomSurface = surface
  }

  return next
}

export function buildWebSettingsForm(
  data: Record<string, any>,
  defaults: WebSettingsFormDefaults,
): SiteConfig {
  const statusCard = normalizeStatusCardSettings(data)
  return {
    adminThemeColor:
      typeof data.adminThemeColor === 'string'
        ? (normalizeAdminThemeColor(data.adminThemeColor) ?? '')
        : '',
    adminBackgroundColor:
      typeof data.adminBackgroundColor === 'string'
        ? (normalizeAdminThemeColor(data.adminBackgroundColor) ?? '')
        : '',
    pageTitle: data.pageTitle ?? DEFAULT_PAGE_TITLE,
    siteIconUrl:
      typeof data.siteIconUrl === 'string' ? (normalizeSiteIconUrl(data.siteIconUrl) ?? '') : '',
    userName: data.userName ?? '',
    userBio: data.userBio ?? '',
    avatarUrl: data.avatarUrl ?? '',
    avatarFetchByServerEnabled:
      isRemoteAvatarUrl(data.avatarUrl) && data.avatarFetchByServerEnabled === true,
    profileOnlineAccentColor:
      normalizeProfileOnlineAccentColor(
        typeof data.profileOnlineAccentColor === 'string' ? data.profileOnlineAccentColor : '',
      ) ?? '',
    profileOnlinePulseEnabled: data.profileOnlinePulseEnabled !== false,
    todayStatusEmoji: normalizeTodayStatusEmoji(data.todayStatusEmoji),
    todayStatusText: normalizeTodayStatusText(data.todayStatusText),
    todayStatusExpiresAt: normalizeTodayStatusExpiresAt(data.todayStatusExpiresAt),
    todayStatusBusy: normalizeTodayStatusBusy(data.todayStatusBusy),
    userNote: data.userNote ?? '',
    userNoteHitokotoEnabled: Boolean(data.userNoteHitokotoEnabled),
    userNoteTypewriterEnabled: Boolean(data.userNoteTypewriterEnabled),
    userNoteSignatureFontEnabled: Boolean(data.userNoteSignatureFontEnabled),
    userNoteSignatureFontFamily:
      typeof data.userNoteSignatureFontFamily === 'string'
        ? data.userNoteSignatureFontFamily.trim()
        : '',
    pageLoadingEnabled: data.pageLoadingEnabled !== false,
    searchEngineIndexingEnabled: data.searchEngineIndexingEnabled !== false,
    userNoteHitokotoCategories: normalizeHitokotoCategories(data.userNoteHitokotoCategories),
    userNoteHitokotoEncode: normalizeHitokotoEncode(data.userNoteHitokotoEncode),
    userNoteHitokotoFallbackToNote: Boolean(data.userNoteHitokotoFallbackToNote),
    themePreset: data.themePreset ?? 'basic',
    themeCustomSurface: themeCustomSurfaceFromApi(data.themeCustomSurface),
    publicFontOptionsEnabled: data.publicFontOptionsEnabled === true,
    publicFontOptions: publicPageFontOptionsFromApi(data.publicFontOptions),
    customCss: data.customCss ?? '',
    mcpThemeToolsEnabled: data.mcpThemeToolsEnabled === true,
    openApiDocsEnabled: data.openApiDocsEnabled !== false,
    aiToolMode:
      String(data.aiToolMode ?? '').trim().toLowerCase() === 'mcp' ? 'mcp' : 'skills',
    historyWindowMinutes: Number(
      data.historyWindowMinutes ?? SITE_CONFIG_HISTORY_WINDOW_DEFAULT_MINUTES,
    ),
    processStaleSeconds: Number(
      data.processStaleSeconds ?? SITE_CONFIG_PROCESS_STALE_DEFAULT_SECONDS,
    ),
    pageLockEnabled: Boolean(data.pageLockEnabled),
    pageLockPassword: '',
    hcaptchaEnabled: Boolean(data.hcaptchaEnabled),
    hcaptchaSiteKey: data.hcaptchaSiteKey ?? '',
    hcaptchaSecretKey: '',
    currentlyText:
      typeof data.currentlyText === 'string' && data.currentlyText.trim().length > 0
        ? data.currentlyText
        : defaults.currentlyTextDefault,
    earlierText:
      typeof data.earlierText === 'string' && data.earlierText.trim().length > 0
        ? data.earlierText
        : defaults.earlierTextDefault,
    adminText: data.adminText ?? 'admin',
    autoAcceptNewDevices: Boolean(data.autoAcceptNewDevices),
    inspirationDeviceRestrictionEnabled: Array.isArray(data.inspirationAllowedDeviceHashes),
    inspirationAllowedDeviceHashes: Array.isArray(data.inspirationAllowedDeviceHashes)
      ? (data.inspirationAllowedDeviceHashes as unknown[])
          .map((item) => String(item ?? '').trim())
          .filter((item) => item.length > 0)
      : [],
    scheduleSlotMinutes: isAllowedSlotMinutes(Number(data.scheduleSlotMinutes))
      ? Number(data.scheduleSlotMinutes)
      : SITE_CONFIG_SCHEDULE_SLOT_DEFAULT_MINUTES,
    schedulePeriodTemplate: resolveSchedulePeriodTemplate(data.schedulePeriodTemplate),
    scheduleGridByWeekday: resolveScheduleGridByWeekday(
      data.scheduleGridByWeekday,
      isAllowedSlotMinutes(Number(data.scheduleSlotMinutes))
        ? Number(data.scheduleSlotMinutes)
        : SITE_CONFIG_SCHEDULE_SLOT_DEFAULT_MINUTES,
    ),
    scheduleCourses: Array.isArray(data.scheduleCourses)
      ? (data.scheduleCourses as ScheduleCourse[])
      : [],
    scheduleIcs: typeof data.scheduleIcs === 'string' ? data.scheduleIcs : '',
    scheduleInClassOnHome: Boolean(data.scheduleInClassOnHome),
    scheduleHomeShowLocation: Boolean(data.scheduleHomeShowLocation),
    scheduleHomeShowTeacher: Boolean(data.scheduleHomeShowTeacher),
    scheduleHomeShowNextUpcoming: Boolean(data.scheduleHomeShowNextUpcoming),
    scheduleHomeAfterClassesLabel:
      typeof data.scheduleHomeAfterClassesLabel === 'string' &&
      data.scheduleHomeAfterClassesLabel.trim().length > 0
        ? data.scheduleHomeAfterClassesLabel.trim().slice(
            0,
            SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_MAX_LEN,
          )
        : SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_DEFAULT,
    globalMouseTiltEnabled: data.globalMouseTiltEnabled === true,
    globalMouseTiltGyroEnabled: data.globalMouseTiltGyroEnabled === true,
    smoothScrollEnabled: data.smoothScrollEnabled === true,
    hideActivityMedia: data.hideActivityMedia === true,
    mediaDisplayShowSource: data.mediaDisplayShowSource === true,
    mediaDisplayShowCover: data.mediaDisplayShowCover === true,
    mediaDisplayShowAppIcon: data.mediaDisplayShowAppIcon === true,
    mediaDisplayShowNcmLink: data.mediaDisplayShowNcmLink === true,
    mediaCoverMaxCount: Number(data.mediaCoverMaxCount ?? 50),
    hideInspirationOnHome: data.hideInspirationOnHome === true,
    disableFrontendDeviceAnimation: data.disableFrontendDeviceAnimation === true,
    activityRejectLockappSleep: data.activityRejectLockappSleep === true,
    displayTimezone: normalizeTimezone(data.displayTimezone),
    forceDisplayTimezone: data.forceDisplayTimezone === true,
    activityUpdateMode: normalizeActivityUpdateMode(data.activityUpdateMode),
    useNoSqlAsCacheRedis:
      data.useNoSqlAsCacheRedis === undefined ? true : data.useNoSqlAsCacheRedis === true,
    redisCacheTtlSeconds: Number(
      data.redisCacheTtlSeconds ?? REDIS_ACTIVITY_FEED_CACHE_TTL_DEFAULT_SECONDS,
    ),
    steamEnabled: Boolean(data.steamEnabled),
    steamId: String(data.steamId ?? ''),
    steamApiKey: '',
    ...statusCard,
  }
}
