import { normalizeAdminThemeColor } from '@/lib/admin-theme-color'
import { normalizeAppMessageRules } from '@/lib/app-message-rules'
import { parseJsonString } from '@/lib/json-parse'
import { normalizeMediaPlaySourceRules } from '@/lib/media-play-source-rules'
import { normalizePublicPageFontOptions } from '@/lib/public-page-font'
import { normalizeReportedAppTitleLimit } from '@/lib/reported-app-title-limit'
import { normalizeSiteIconUrl } from '@/lib/site-icon'
import {
  normalizeStatusCardSettings,
} from '@/lib/status-card-options'
import { parseThemeCustomSurface } from '@/lib/theme-custom-surface'
import {
  normalizeTodayStatusBusy,
  normalizeTodayStatusEmoji,
  normalizeTodayStatusExpiresAt,
  normalizeTodayStatusText,
} from '@/lib/today-status'

function normalizeStringArrayField(raw: unknown): string[] {
  const parsed = parseJsonString(raw)
  if (!Array.isArray(parsed)) return []
  return parsed.map((item: unknown) => String(item ?? '').trim()).filter((item) => item.length > 0)
}

export function normalizeSiteConfigShape(config: Record<string, any>): Record<string, any> {
  const mediaCoverMaxCount = Number(config.mediaCoverMaxCount)
  const statusCard = normalizeStatusCardSettings(config)

  return {
    ...config,
    adminThemeColor: normalizeAdminThemeColor(config.adminThemeColor ?? '') ?? null,
    adminBackgroundColor: normalizeAdminThemeColor(config.adminBackgroundColor ?? '') ?? null,
    siteIconUrl: normalizeSiteIconUrl(config.siteIconUrl ?? '') ?? null,
    hideInspirationOnHome: config.hideInspirationOnHome === true,
    disableFrontendDeviceAnimation: config.disableFrontendDeviceAnimation === true,
    smoothScrollEnabled: config.smoothScrollEnabled === true,
    todayStatusEmoji: normalizeTodayStatusEmoji(config.todayStatusEmoji) || null,
    todayStatusText: normalizeTodayStatusText(config.todayStatusText) || null,
    todayStatusExpiresAt: normalizeTodayStatusExpiresAt(config.todayStatusExpiresAt) || null,
    todayStatusBusy: normalizeTodayStatusBusy(config.todayStatusBusy),
    mediaDisplayShowSource: config.mediaDisplayShowSource === true,
    mediaDisplayShowCover: config.mediaDisplayShowCover === true,
    mediaDisplayShowAppIcon: config.mediaDisplayShowAppIcon === true,
    mediaDisplayShowNcmLink: config.mediaDisplayShowNcmLink === true,
    ...statusCard,
    mediaCoverMaxCount: Number.isFinite(mediaCoverMaxCount)
      ? Math.min(Math.max(Math.round(mediaCoverMaxCount), 0), 500)
      : 50,
    forceDisplayTimezone: config.forceDisplayTimezone === true,
    themeCustomSurface: parseThemeCustomSurface(config.themeCustomSurface),
    publicFontOptionsEnabled: config.publicFontOptionsEnabled === true,
    publicFontOptions: normalizePublicPageFontOptions(config.publicFontOptions),
    userNoteHitokotoCategories: normalizeStringArrayField(config.userNoteHitokotoCategories),
    inspirationAllowedDeviceHashes:
      config.inspirationAllowedDeviceHashes === null
        ? null
        : normalizeStringArrayField(config.inspirationAllowedDeviceHashes),
    schedulePeriodTemplate: parseJsonString(config.schedulePeriodTemplate),
    scheduleGridByWeekday: parseJsonString(config.scheduleGridByWeekday),
    scheduleCourses: parseJsonString(config.scheduleCourses),
    appMessageRules: normalizeAppMessageRules(config.appMessageRules),
    appBlacklist: normalizeStringArrayField(config.appBlacklist),
    appWhitelist: normalizeStringArrayField(config.appWhitelist),
    appNameOnlyList: normalizeStringArrayField(config.appNameOnlyList),
    captureReportedAppTitleLimit: normalizeReportedAppTitleLimit(
      config.captureReportedAppTitleLimit,
    ),
    mediaPlaySourceBlocklist: normalizeStringArrayField(config.mediaPlaySourceBlocklist),
    mediaPlaySourceRules: normalizeMediaPlaySourceRules(
      parseJsonString(config.mediaPlaySourceRules),
      config.mediaPlaySourceBlocklist,
    ),
  }
}
