import { normalizeAdminThemeColor } from '@/lib/admin-theme-color'
import { normalizeAppMessageRules } from '@/lib/app-message-rules'
import { normalizePublicPageFontOptions } from '@/lib/public-page-font'
import { parseThemeCustomSurface } from '@/lib/theme-custom-surface'

function parseJsonString(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw
  const trimmed = raw.trim()
  if (!trimmed) return raw
  try {
    return JSON.parse(trimmed)
  } catch {
    return raw
  }
}

function normalizeStringArrayField(raw: unknown): string[] {
  const parsed = parseJsonString(raw)
  if (!Array.isArray(parsed)) return []
  return parsed.map((item: unknown) => String(item ?? '').trim()).filter((item) => item.length > 0)
}

export function normalizeSiteConfigShape(config: Record<string, any>): Record<string, any> {
  return {
    ...config,
    adminThemeColor: normalizeAdminThemeColor(config.adminThemeColor ?? '') ?? null,
    adminBackgroundColor: normalizeAdminThemeColor(config.adminBackgroundColor ?? '') ?? null,
    hideInspirationOnHome: config.hideInspirationOnHome === true,
    smoothScrollEnabled: config.smoothScrollEnabled === true,
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
    mediaPlaySourceBlocklist: normalizeStringArrayField(config.mediaPlaySourceBlocklist),
  }
}
