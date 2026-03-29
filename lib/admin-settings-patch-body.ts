import {
  normalizeHitokotoCategories,
  normalizeHitokotoEncode,
} from '@/lib/hitokoto'
import {
  backfillCoursePeriodIdsFromTemplate,
  resolveSchedulePeriodTemplate,
} from '@/lib/schedule-courses'
import { resolveScheduleGridByWeekday } from '@/lib/schedule-grid-by-weekday'
import {
  SITE_CONFIG_HISTORY_WINDOW_DEFAULT_MINUTES,
  SITE_CONFIG_PROCESS_STALE_DEFAULT_SECONDS,
  SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_DEFAULT,
  SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_MAX_LEN,
  SITE_CONFIG_SCHEDULE_SLOT_DEFAULT_MINUTES,
} from '@/lib/site-config-constants'

/**
 * Build JSON body for PATCH /api/admin/settings from a GET response row plus overrides.
 */
export function buildAdminSettingsPatchBody(
  data: Record<string, unknown>,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const scheduleSlotMinutes =
    typeof data.scheduleSlotMinutes === 'number'
      ? data.scheduleSlotMinutes
      : SITE_CONFIG_SCHEDULE_SLOT_DEFAULT_MINUTES
  const schedulePeriodTemplate = resolveSchedulePeriodTemplate(data.schedulePeriodTemplate)
  const scheduleCoursesRaw = Array.isArray(data.scheduleCourses) ? data.scheduleCourses : []
  const scheduleCourses = backfillCoursePeriodIdsFromTemplate(
    scheduleCoursesRaw,
    schedulePeriodTemplate,
  ).courses

  return {
    pageTitle: data.pageTitle,
    userName: data.userName,
    userBio: data.userBio,
    avatarUrl: data.avatarUrl,
    userNote: data.userNote ?? '',
    userNoteHitokotoEnabled: Boolean(data.userNoteHitokotoEnabled),
    userNoteHitokotoCategories: normalizeHitokotoCategories(
      data.userNoteHitokotoCategories ?? [],
    ),
    userNoteHitokotoEncode: normalizeHitokotoEncode(data.userNoteHitokotoEncode),
    themePreset: data.themePreset ?? 'basic',
    themeCustomSurface: data.themeCustomSurface,
    customCss: data.customCss ?? '',
    historyWindowMinutes: data.historyWindowMinutes ?? SITE_CONFIG_HISTORY_WINDOW_DEFAULT_MINUTES,
    processStaleSeconds: data.processStaleSeconds ?? SITE_CONFIG_PROCESS_STALE_DEFAULT_SECONDS,
    appMessageRules: data.appMessageRules ?? [],
    appMessageRulesShowProcessName: (data as Record<string, unknown>).appMessageRulesShowProcessName !== false,
    appBlacklist: data.appBlacklist ?? [],
    appWhitelist: data.appWhitelist ?? [],
    appFilterMode: data.appFilterMode ?? 'blacklist',
    appNameOnlyList: data.appNameOnlyList ?? [],
    pageLockEnabled: data.pageLockEnabled ?? false,
    currentlyText: data.currentlyText ?? '当前状态',
    earlierText: data.earlierText ?? '最近的随想录',
    adminText: data.adminText ?? 'admin',
    autoAcceptNewDevices: data.autoAcceptNewDevices ?? false,
    inspirationAllowedDeviceHashes:
      'inspirationAllowedDeviceHashes' in data
        ? (data.inspirationAllowedDeviceHashes as string[] | null)
        : null,
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
    globalMouseTiltEnabled: Boolean(data.globalMouseTiltEnabled),
    hideActivityMedia: Boolean(data.hideActivityMedia),
    scheduleSlotMinutes,
    schedulePeriodTemplate,
    scheduleGridByWeekday: resolveScheduleGridByWeekday(
      data.scheduleGridByWeekday,
      scheduleSlotMinutes,
    ),
    scheduleCourses,
    scheduleIcs: typeof data.scheduleIcs === 'string' ? data.scheduleIcs : '',
    ...overrides,
  }
}
