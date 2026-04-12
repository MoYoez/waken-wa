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

function normalizeAppMessageRulesField(raw: unknown): Array<{ match: string; text: string }> {
  const parsed = parseJsonString(raw)
  if (!Array.isArray(parsed)) return []
  return parsed
    .map((item) => ({
      match: String((item as { match?: unknown })?.match ?? '').trim(),
      text: String((item as { text?: unknown })?.text ?? '').trim(),
    }))
    .filter((item) => item.match.length > 0 && item.text.length > 0)
}

export function normalizeSiteConfigShape(config: Record<string, any>): Record<string, any> {
  return {
    ...config,
    forceDisplayTimezone: config.forceDisplayTimezone === true,
    themeCustomSurface: parseThemeCustomSurface(config.themeCustomSurface),
    userNoteHitokotoCategories: normalizeStringArrayField(config.userNoteHitokotoCategories),
    inspirationAllowedDeviceHashes:
      config.inspirationAllowedDeviceHashes === null
        ? null
        : normalizeStringArrayField(config.inspirationAllowedDeviceHashes),
    schedulePeriodTemplate: parseJsonString(config.schedulePeriodTemplate),
    scheduleGridByWeekday: parseJsonString(config.scheduleGridByWeekday),
    scheduleCourses: parseJsonString(config.scheduleCourses),
    appMessageRules: normalizeAppMessageRulesField(config.appMessageRules),
    appBlacklist: normalizeStringArrayField(config.appBlacklist),
    appWhitelist: normalizeStringArrayField(config.appWhitelist),
    appNameOnlyList: normalizeStringArrayField(config.appNameOnlyList),
    mediaPlaySourceBlocklist: normalizeStringArrayField(config.mediaPlaySourceBlocklist),
  }
}
