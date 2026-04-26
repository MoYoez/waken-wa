import 'server-only'

import { and, asc, eq } from 'drizzle-orm'

import { normalizeAppMessageRules } from '@/lib/app-message-rules'
import { db } from '@/lib/db'
import {
  siteSettingsV2ListEntries,
  siteSettingsMigrationMeta,
  siteSettingsV2RuleGroups,
  siteSettingsV2RuleTitleRules,
  siteSettingsV2ScheduleCoursePeriodIds,
  siteSettingsV2ScheduleCourses,
  siteSettingsV2ScheduleCourseTimeSessions,
  siteSettingsV2ScheduleGridDays,
  siteSettingsV2SchedulePeriods,
  siteSettingsV2ThemeCustomSurface,
  siteSettingsV2ThemeCustomSurfaceImagePool,
  siteSettingsV2ThemePublicFontOptions,
  siteSettingsV2ValueEntries,
} from '@/lib/drizzle-schema'
import { parseJsonString } from '@/lib/json-parse'
import { normalizePublicPageFontOptions } from '@/lib/public-page-font'
import { normalizeSiteConfigShape } from '@/lib/site-config-normalize'
import {
  pickSiteConfigBodyFields,
  readLegacySiteConfigRow,
  readSiteConfigV2Record,
} from '@/lib/site-config-v2'
import {
  isSiteSettingsMigrationState,
  omitRecordKeys,
  pickRecordKeys,
  SITE_SETTINGS_CLEAR_LEGACY_VALUES,
  SITE_SETTINGS_COVERED_CATEGORIES,
  SITE_SETTINGS_RULES_KEYS,
  SITE_SETTINGS_SCHEDULE_CATEGORY_KEYS,
  SITE_SETTINGS_THEME_CATEGORY_KEYS,
  type SiteSettingsMigrationState,
} from '@/lib/site-settings-constants'
import { parseThemeCustomSurface } from '@/lib/theme-custom-surface'

export const SITE_SETTINGS_SITE_CONFIG_ID = 1

type SiteSettingsRecord = Record<string, unknown>
type ManagedCategory = 'theme' | 'schedule' | 'rules'

type SiteSettingsSectionSnapshot = {
  values: SiteSettingsRecord
  rowCount: number
}

export type SiteSettingsMigrationSnapshot = {
  siteConfigId: number
  migrationState: SiteSettingsMigrationState
  migratedAt: unknown
  legacyDataClearedAt: unknown
  legacyDataPresent: boolean
  stateInferred: boolean
}

export type SiteSettingsSnapshot = {
  legacySiteConfigRow: SiteSettingsRecord | null
  coreSiteConfigRow: SiteSettingsRecord | null
  migration: SiteSettingsMigrationSnapshot
  themeValues: SiteSettingsRecord
  themeRowCount: number
  scheduleValues: SiteSettingsRecord
  scheduleRowCount: number
  rulesValues: SiteSettingsRecord
  rulesRowCount: number
}

const THEME_CUSTOM_SURFACE_STRING_KEYS = [
  'background',
  'bodyBackground',
  'animatedBg',
  'primary',
  'secondary',
  'accent',
  'online',
  'foreground',
  'card',
  'border',
  'muted',
  'mutedForeground',
  'homeCardOverlay',
  'homeCardOverlayDark',
  'homeCardInsetHighlight',
  'animatedBgTint1',
  'animatedBgTint2',
  'animatedBgTint3',
  'floatingOrbColor1',
  'floatingOrbColor2',
  'floatingOrbColor3',
  'radius',
  'backgroundImageMode',
  'backgroundImageUrl',
  'backgroundRandomApiUrl',
  'paletteMode',
  'paletteLiveScope',
  'paletteSeedImageUrl',
] as const

const THEME_CUSTOM_SURFACE_BOOLEAN_KEYS = [
  'hideFloatingOrbs',
  'transparentAnimatedBg',
  'paletteLiveEnabled',
] as const

function toRecord(value: unknown): SiteSettingsRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  return value as SiteSettingsRecord
}

function getSqliteMissingTable(error: unknown): string | null {
  const message = String((error as { message?: unknown })?.message ?? '')
  const match = message.match(/no such table:\s*(\S+)/i)
  return match?.[1] ?? null
}

function getPostgresMissingTable(error: unknown): string | null {
  const message = String((error as { message?: unknown })?.message ?? '')
  const match = message.match(/relation\s+"([^"]+)"\s+does not exist/i)
  return match?.[1] ?? null
}

function isMissingTableError(error: unknown, tableNames: readonly string[]): boolean {
  const tableName = (getSqliteMissingTable(error) ?? getPostgresMissingTable(error) ?? '')
    .trim()
    .replace(/^["']|["']$/g, '')
  return tableNames.includes(tableName)
}

async function runOrNullWhenMissingTables<T>(
  tableNames: readonly string[],
  run: () => Promise<T>,
): Promise<T | null> {
  try {
    return await run()
  } catch (error) {
    if (isMissingTableError(error, tableNames)) {
      return null
    }
    throw error
  }
}

async function selectValueEntryRows(
  executor: any,
  category: ManagedCategory,
): Promise<SiteSettingsRecord[]> {
  const rows =
    (await runOrNullWhenMissingTables<unknown[]>(['site_settings_v2_value_entries'], () =>
      executor
        .select()
        .from(siteSettingsV2ValueEntries)
        .where(
          and(
            eq(siteSettingsV2ValueEntries.siteConfigId, SITE_SETTINGS_SITE_CONFIG_ID),
            eq(siteSettingsV2ValueEntries.category, category),
          ),
        ),
    )) ?? []

  return rows
    .map((row: unknown) => toRecord(row))
    .filter((row: SiteSettingsRecord | null): row is SiteSettingsRecord => row !== null)
}

async function selectListEntryRows(
  executor: any,
  category: ManagedCategory,
): Promise<SiteSettingsRecord[]> {
  const rows =
    (await runOrNullWhenMissingTables<unknown[]>(['site_settings_v2_list_entries'], () =>
      executor
        .select()
        .from(siteSettingsV2ListEntries)
        .where(
          and(
            eq(siteSettingsV2ListEntries.siteConfigId, SITE_SETTINGS_SITE_CONFIG_ID),
            eq(siteSettingsV2ListEntries.category, category),
          ),
        )
        .orderBy(
          asc(siteSettingsV2ListEntries.settingKey),
          asc(siteSettingsV2ListEntries.position),
        ),
    )) ?? []

  return rows
    .map((row: unknown) => toRecord(row))
    .filter((row: SiteSettingsRecord | null): row is SiteSettingsRecord => row !== null)
}

function decodeScalarEntryValue(row: SiteSettingsRecord): unknown {
  const valueKind = String(row.valueKind ?? '').trim().toLowerCase()
  if (valueKind === 'string') {
    return typeof row.stringValue === 'string' ? row.stringValue : ''
  }
  if (valueKind === 'number') {
    const value = Number(row.numberValue)
    return Number.isFinite(value) ? value : null
  }
  if (valueKind === 'boolean') {
    return row.booleanValue === true || row.booleanValue === 1
  }
  return null
}

function readBooleanLike(value: unknown): boolean | undefined {
  if (value === true || value === 1) return true
  if (value === false || value === 0) return false
  return undefined
}

function readNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  return value.length > 0 ? value : undefined
}

function parseArrayLike(raw: unknown): unknown[] {
  const parsed = parseJsonString(raw)
  return Array.isArray(parsed) ? parsed : []
}

function hasThemeCustomSurfaceData(raw: unknown): boolean {
  const surface = parseThemeCustomSurface(raw)
  if (Array.isArray(surface.backgroundImagePool) && surface.backgroundImagePool.length > 0) {
    return true
  }

  return Object.entries(surface).some(([key, value]) => {
    if (key === 'backgroundImagePool') return false
    if (typeof value === 'string') return value.trim().length > 0
    return typeof value === 'boolean'
  })
}

function hasLegacyManagedData(siteConfigRow: SiteSettingsRecord | null): boolean {
  if (!siteConfigRow) {
    return false
  }

  const legacyDefaults = SITE_SETTINGS_CLEAR_LEGACY_VALUES
  const scheduleSlotDefault = Number(legacyDefaults.scheduleSlotMinutes ?? 30)
  const scheduleAfterClassesDefault = String(
    legacyDefaults.scheduleHomeAfterClassesLabel ?? '正在摸鱼',
  )

  return (
    String(siteConfigRow.themePreset ?? 'basic').trim() !== 'basic' ||
    (siteConfigRow.publicFontOptionsEnabled === true ||
      siteConfigRow.publicFontOptionsEnabled === 1) ||
    hasThemeCustomSurfaceData(siteConfigRow.themeCustomSurface) ||
    normalizePublicPageFontOptions(siteConfigRow.publicFontOptions).length > 0 ||
    String(siteConfigRow.customCss ?? '').trim().length > 0 ||
    Number(siteConfigRow.scheduleSlotMinutes ?? scheduleSlotDefault) !== scheduleSlotDefault ||
    parseArrayLike(siteConfigRow.schedulePeriodTemplate).length > 0 ||
    parseArrayLike(siteConfigRow.scheduleGridByWeekday).length > 0 ||
    parseArrayLike(siteConfigRow.scheduleCourses).length > 0 ||
    String(siteConfigRow.scheduleIcs ?? '').trim().length > 0 ||
    siteConfigRow.scheduleInClassOnHome === true ||
    siteConfigRow.scheduleInClassOnHome === 1 ||
    siteConfigRow.scheduleHomeShowLocation === true ||
    siteConfigRow.scheduleHomeShowLocation === 1 ||
    siteConfigRow.scheduleHomeShowTeacher === true ||
    siteConfigRow.scheduleHomeShowTeacher === 1 ||
    siteConfigRow.scheduleHomeShowNextUpcoming === true ||
    siteConfigRow.scheduleHomeShowNextUpcoming === 1 ||
    String(siteConfigRow.scheduleHomeAfterClassesLabel ?? scheduleAfterClassesDefault) !==
      scheduleAfterClassesDefault ||
    normalizeAppMessageRules(siteConfigRow.appMessageRules).length > 0 ||
    siteConfigRow.appMessageRulesShowProcessName === false ||
    siteConfigRow.appMessageRulesShowProcessName === 0 ||
    String(siteConfigRow.appFilterMode ?? 'blacklist').trim().toLowerCase() !== 'blacklist' ||
    parseArrayLike(siteConfigRow.appBlacklist).length > 0 ||
    parseArrayLike(siteConfigRow.appWhitelist).length > 0 ||
    parseArrayLike(siteConfigRow.appNameOnlyList).length > 0 ||
    siteConfigRow.captureReportedAppsEnabled === false ||
    siteConfigRow.captureReportedAppsEnabled === 0 ||
    parseArrayLike(siteConfigRow.mediaPlaySourceBlocklist).length > 0
  )
}

function normalizeMigrationSnapshot(
  row: SiteSettingsRecord | null,
  legacySiteConfigRow: SiteSettingsRecord | null,
  hasPersistedV2Data: boolean,
): SiteSettingsMigrationSnapshot {
  const rawState = row?.migrationState
  const legacyDataPresent = hasLegacyManagedData(legacySiteConfigRow)
  const migrationState = isSiteSettingsMigrationState(rawState)
    ? rawState
    : hasPersistedV2Data
      ? 'migrated'
      : 'legacy'

  return {
    siteConfigId: SITE_SETTINGS_SITE_CONFIG_ID,
    migrationState,
    migratedAt: row?.migratedAt ?? null,
    legacyDataClearedAt: row?.legacyDataClearedAt ?? null,
    legacyDataPresent,
    stateInferred: !isSiteSettingsMigrationState(rawState),
  }
}

async function readMigrationMetaRow(executor: any): Promise<SiteSettingsRecord | null> {
  const rows = await runOrNullWhenMissingTables<unknown[]>(
    ['site_settings_v2_migration_meta'],
    () =>
      executor
        .select()
        .from(siteSettingsMigrationMeta)
        .where(eq(siteSettingsMigrationMeta.siteConfigId, SITE_SETTINGS_SITE_CONFIG_ID))
        .limit(1),
  )

  if (!rows || rows.length === 0) {
    return null
  }

  return toRecord(rows[0])
}

async function readThemeSettingsSnapshot(executor: any): Promise<SiteSettingsSectionSnapshot> {
  const result = await runOrNullWhenMissingTables(
    [
      'site_settings_v2_theme_custom_surface',
      'site_settings_v2_theme_custom_surface_image_pool',
      'site_settings_v2_theme_public_font_options',
    ],
    async () => {
      const [scalarRows, customSurfaceRows, imagePoolRows, fontRows] = await Promise.all([
        selectValueEntryRows(executor, 'theme'),
        executor
          .select()
          .from(siteSettingsV2ThemeCustomSurface)
          .where(eq(siteSettingsV2ThemeCustomSurface.siteConfigId, SITE_SETTINGS_SITE_CONFIG_ID))
          .limit(1),
        executor
          .select()
          .from(siteSettingsV2ThemeCustomSurfaceImagePool)
          .where(
            eq(
              siteSettingsV2ThemeCustomSurfaceImagePool.siteConfigId,
              SITE_SETTINGS_SITE_CONFIG_ID,
            ),
          )
          .orderBy(asc(siteSettingsV2ThemeCustomSurfaceImagePool.position)),
        executor
          .select()
          .from(siteSettingsV2ThemePublicFontOptions)
          .where(
            eq(siteSettingsV2ThemePublicFontOptions.siteConfigId, SITE_SETTINGS_SITE_CONFIG_ID),
          )
          .orderBy(asc(siteSettingsV2ThemePublicFontOptions.position)),
      ])

      return {
        scalarRows: scalarRows
          .map((row: unknown) => toRecord(row))
          .filter((row: SiteSettingsRecord | null): row is SiteSettingsRecord => row !== null),
        customSurfaceRow: toRecord(customSurfaceRows[0]),
        imagePoolRows: imagePoolRows
          .map((row: unknown) => toRecord(row))
          .filter((row: SiteSettingsRecord | null): row is SiteSettingsRecord => row !== null),
        fontRows: fontRows
          .map((row: unknown) => toRecord(row))
          .filter((row: SiteSettingsRecord | null): row is SiteSettingsRecord => row !== null),
      }
    },
  )

  if (!result) {
    return { values: {}, rowCount: 0 }
  }

  const values: SiteSettingsRecord = {}

  for (const row of result.scalarRows) {
    const settingKey = String(row.settingKey ?? '').trim()
    if (!settingKey) continue
    values[settingKey] = decodeScalarEntryValue(row)
  }

  if (result.customSurfaceRow || result.imagePoolRows.length > 0) {
    const surface: SiteSettingsRecord = {}

    for (const key of THEME_CUSTOM_SURFACE_STRING_KEYS) {
      const value = readNonEmptyString(result.customSurfaceRow?.[key])
      if (value !== undefined) {
        surface[key] = value
      }
    }

    for (const key of THEME_CUSTOM_SURFACE_BOOLEAN_KEYS) {
      const value = readBooleanLike(result.customSurfaceRow?.[key])
      if (value !== undefined) {
        surface[key] = value
      }
    }

    if (result.imagePoolRows.length > 0) {
      surface.backgroundImagePool = result.imagePoolRows
        .map((row: SiteSettingsRecord) => String(row.imageUrl ?? ''))
        .filter((value: string) => value.length > 0)
    }

    values.themeCustomSurface = surface
  }

  if (result.fontRows.length > 0) {
    values.publicFontOptions = result.fontRows.map((row: SiteSettingsRecord) => ({
      mode: String(row.mode ?? 'default'),
      label: String(row.label ?? ''),
      family: String(row.family ?? ''),
      ...(typeof row.url === 'string' && row.url.length > 0 ? { url: row.url } : {}),
    }))
  }

  return {
    values,
    rowCount:
      result.scalarRows.length +
      (result.customSurfaceRow ? 1 : 0) +
      result.imagePoolRows.length +
      result.fontRows.length,
  }
}

async function readScheduleSettingsSnapshot(executor: any): Promise<SiteSettingsSectionSnapshot> {
  const result = await runOrNullWhenMissingTables(
    [
      'site_settings_v2_schedule_periods',
      'site_settings_v2_schedule_grid_days',
      'site_settings_v2_schedule_courses',
      'site_settings_v2_schedule_course_time_sessions',
      'site_settings_v2_schedule_course_period_ids',
    ],
    async () => {
      const [
        scalarRows,
        periodRows,
        gridDayRows,
        courseRows,
        timeSessionRows,
        periodIdRows,
      ] = await Promise.all([
        selectValueEntryRows(executor, 'schedule'),
        executor
          .select()
          .from(siteSettingsV2SchedulePeriods)
          .where(eq(siteSettingsV2SchedulePeriods.siteConfigId, SITE_SETTINGS_SITE_CONFIG_ID))
          .orderBy(
            asc(siteSettingsV2SchedulePeriods.position),
            asc(siteSettingsV2SchedulePeriods.sortOrder),
          ),
        executor
          .select()
          .from(siteSettingsV2ScheduleGridDays)
          .where(eq(siteSettingsV2ScheduleGridDays.siteConfigId, SITE_SETTINGS_SITE_CONFIG_ID))
          .orderBy(
            asc(siteSettingsV2ScheduleGridDays.position),
            asc(siteSettingsV2ScheduleGridDays.weekday),
          ),
        executor
          .select()
          .from(siteSettingsV2ScheduleCourses)
          .where(eq(siteSettingsV2ScheduleCourses.siteConfigId, SITE_SETTINGS_SITE_CONFIG_ID))
          .orderBy(asc(siteSettingsV2ScheduleCourses.position)),
        executor
          .select()
          .from(siteSettingsV2ScheduleCourseTimeSessions)
          .where(
            eq(
              siteSettingsV2ScheduleCourseTimeSessions.siteConfigId,
              SITE_SETTINGS_SITE_CONFIG_ID,
            ),
          )
          .orderBy(
            asc(siteSettingsV2ScheduleCourseTimeSessions.courseId),
            asc(siteSettingsV2ScheduleCourseTimeSessions.position),
          ),
        executor
          .select()
          .from(siteSettingsV2ScheduleCoursePeriodIds)
          .where(
            eq(siteSettingsV2ScheduleCoursePeriodIds.siteConfigId, SITE_SETTINGS_SITE_CONFIG_ID),
          )
          .orderBy(
            asc(siteSettingsV2ScheduleCoursePeriodIds.courseId),
            asc(siteSettingsV2ScheduleCoursePeriodIds.position),
          ),
      ])

      return {
        scalarRows: scalarRows
          .map((row: unknown) => toRecord(row))
          .filter((row: SiteSettingsRecord | null): row is SiteSettingsRecord => row !== null),
        periodRows: periodRows
          .map((row: unknown) => toRecord(row))
          .filter((row: SiteSettingsRecord | null): row is SiteSettingsRecord => row !== null),
        gridDayRows: gridDayRows
          .map((row: unknown) => toRecord(row))
          .filter((row: SiteSettingsRecord | null): row is SiteSettingsRecord => row !== null),
        courseRows: courseRows
          .map((row: unknown) => toRecord(row))
          .filter((row: SiteSettingsRecord | null): row is SiteSettingsRecord => row !== null),
        timeSessionRows: timeSessionRows
          .map((row: unknown) => toRecord(row))
          .filter((row: SiteSettingsRecord | null): row is SiteSettingsRecord => row !== null),
        periodIdRows: periodIdRows
          .map((row: unknown) => toRecord(row))
          .filter((row: SiteSettingsRecord | null): row is SiteSettingsRecord => row !== null),
      }
    },
  )

  if (!result) {
    return { values: {}, rowCount: 0 }
  }

  const values: SiteSettingsRecord = {}

  for (const row of result.scalarRows) {
    const settingKey = String(row.settingKey ?? '').trim()
    if (!settingKey) continue
    values[settingKey] = decodeScalarEntryValue(row)
  }

  if (result.periodRows.length > 0) {
    values.schedulePeriodTemplate = result.periodRows.map((row: SiteSettingsRecord) => ({
      id: String(row.periodId ?? ''),
      label: String(row.label ?? ''),
      part: String(row.part ?? 'morning'),
      startTime: String(row.startTime ?? ''),
      endTime: String(row.endTime ?? ''),
      order: Number.isFinite(Number(row.sortOrder)) ? Number(row.sortOrder) : 0,
    }))
  }

  if (result.gridDayRows.length > 0) {
    values.scheduleGridByWeekday = result.gridDayRows.map((row: SiteSettingsRecord) => ({
      rangeStart: String(row.rangeStart ?? ''),
      rangeEnd: String(row.rangeEnd ?? ''),
      intervalMinutes: Number.isFinite(Number(row.intervalMinutes))
        ? Number(row.intervalMinutes)
        : 30,
      useFixedInterval: readBooleanLike(row.useFixedInterval) === true,
    }))
  }

  if (result.courseRows.length > 0) {
    const timeSessionsByCourseId = new Map<string, SiteSettingsRecord[]>()
    const periodIdsByCourseId = new Map<string, SiteSettingsRecord[]>()

    for (const row of result.timeSessionRows) {
      const courseId = String(row.courseId ?? '').trim()
      if (!courseId) continue
      const bucket = timeSessionsByCourseId.get(courseId) ?? []
      bucket.push(row)
      timeSessionsByCourseId.set(courseId, bucket)
    }

    for (const row of result.periodIdRows) {
      const courseId = String(row.courseId ?? '').trim()
      if (!courseId) continue
      const bucket = periodIdsByCourseId.get(courseId) ?? []
      bucket.push(row)
      periodIdsByCourseId.set(courseId, bucket)
    }

    values.scheduleCourses = result.courseRows.map((row: SiteSettingsRecord) => {
      const courseId = String(row.courseId ?? '')
      const course: SiteSettingsRecord = {
        id: courseId,
        title: String(row.title ?? ''),
        weekday: Number.isFinite(Number(row.weekday)) ? Number(row.weekday) : 0,
        startTime: String(row.startTime ?? ''),
        endTime: String(row.endTime ?? ''),
        anchorDate: String(row.anchorDate ?? ''),
      }

      if (typeof row.location === 'string' && row.location.length > 0) {
        course.location = row.location
      }
      if (typeof row.teacher === 'string' && row.teacher.length > 0) {
        course.teacher = row.teacher
      }
      if (typeof row.timeMode === 'string' && row.timeMode.length > 0) {
        course.timeMode = row.timeMode
      }
      if (typeof row.untilDate === 'string' && row.untilDate.length > 0) {
        course.untilDate = row.untilDate
      }

      const timeSessions = (timeSessionsByCourseId.get(courseId) ?? []).map((sessionRow) => ({
        startTime: String(sessionRow.startTime ?? ''),
        endTime: String(sessionRow.endTime ?? ''),
      }))
      if (timeSessions.length > 0) {
        course.timeSessions = timeSessions
      }

      const periodIds = (periodIdsByCourseId.get(courseId) ?? [])
        .map((periodRow: SiteSettingsRecord) => String(periodRow.periodId ?? ''))
        .filter((value: string) => value.length > 0)
      if (periodIds.length > 0) {
        course.periodIds = periodIds
      }

      return course
    })
  }

  return {
    values,
    rowCount:
      result.scalarRows.length +
      result.periodRows.length +
      result.gridDayRows.length +
      result.courseRows.length +
      result.timeSessionRows.length +
      result.periodIdRows.length,
  }
}

async function readRulesSettingsSnapshot(executor: any): Promise<SiteSettingsSectionSnapshot> {
  const result = await runOrNullWhenMissingTables(
    [
      'site_settings_v2_rule_groups',
      'site_settings_v2_rule_title_rules',
    ],
    async () => {
      const [scalarRows, stringListRows, groupRows, titleRuleRows] = await Promise.all([
        selectValueEntryRows(executor, 'rules'),
        selectListEntryRows(executor, 'rules'),
        executor
          .select()
          .from(siteSettingsV2RuleGroups)
          .where(eq(siteSettingsV2RuleGroups.siteConfigId, SITE_SETTINGS_SITE_CONFIG_ID))
          .orderBy(asc(siteSettingsV2RuleGroups.position)),
        executor
          .select()
          .from(siteSettingsV2RuleTitleRules)
          .where(eq(siteSettingsV2RuleTitleRules.siteConfigId, SITE_SETTINGS_SITE_CONFIG_ID))
          .orderBy(
            asc(siteSettingsV2RuleTitleRules.groupId),
            asc(siteSettingsV2RuleTitleRules.position),
          ),
      ])

      return {
        scalarRows: scalarRows
          .map((row: unknown) => toRecord(row))
          .filter((row: SiteSettingsRecord | null): row is SiteSettingsRecord => row !== null),
        stringListRows: stringListRows
          .map((row: unknown) => toRecord(row))
          .filter((row: SiteSettingsRecord | null): row is SiteSettingsRecord => row !== null),
        groupRows: groupRows
          .map((row: unknown) => toRecord(row))
          .filter((row: SiteSettingsRecord | null): row is SiteSettingsRecord => row !== null),
        titleRuleRows: titleRuleRows
          .map((row: unknown) => toRecord(row))
          .filter((row: SiteSettingsRecord | null): row is SiteSettingsRecord => row !== null),
      }
    },
  )

  if (!result) {
    return { values: {}, rowCount: 0 }
  }

  const values: SiteSettingsRecord = {}

  for (const row of result.scalarRows) {
    const settingKey = String(row.settingKey ?? '').trim()
    if (!settingKey) continue
    values[settingKey] = decodeScalarEntryValue(row)
  }

  const stringListRowsByKey = new Map<string, string[]>()
  for (const row of result.stringListRows) {
    const settingKey = String(row.settingKey ?? '').trim()
    if (!settingKey) continue
    const bucket = stringListRowsByKey.get(settingKey) ?? []
    const itemValue = String(row.itemValue ?? '')
    if (itemValue.length > 0) {
      bucket.push(itemValue)
    }
    stringListRowsByKey.set(settingKey, bucket)
  }

  for (const listKey of [
    'appBlacklist',
    'appWhitelist',
    'appNameOnlyList',
    'mediaPlaySourceBlocklist',
  ]) {
    const items = stringListRowsByKey.get(listKey)
    if (items && items.length > 0) {
      values[listKey] = items
    }
  }

  if (result.groupRows.length > 0) {
    const titleRulesByGroupId = new Map<string, SiteSettingsRecord[]>()
    for (const row of result.titleRuleRows) {
      const groupId = String(row.groupId ?? '').trim()
      if (!groupId) continue
      const bucket = titleRulesByGroupId.get(groupId) ?? []
      bucket.push(row)
      titleRulesByGroupId.set(groupId, bucket)
    }

    values.appMessageRules = result.groupRows.map((row: SiteSettingsRecord) => ({
      id: String(row.groupId ?? ''),
      processMatch: String(row.processMatch ?? ''),
      ...(typeof row.defaultText === 'string' && row.defaultText.length > 0
        ? { defaultText: row.defaultText }
        : {}),
      titleRules: (titleRulesByGroupId.get(String(row.groupId ?? '')) ?? []).map(
        (titleRuleRow: SiteSettingsRecord) => ({
          id: String(titleRuleRow.titleRuleId ?? ''),
          mode: String(titleRuleRow.mode ?? 'plain') === 'regex' ? 'regex' : 'plain',
          pattern: String(titleRuleRow.pattern ?? ''),
          text: String(titleRuleRow.textValue ?? ''),
        }),
      ),
    }))
  }

  return {
    values,
    rowCount:
      result.scalarRows.length +
      result.stringListRows.length +
      result.groupRows.length +
      result.titleRuleRows.length,
  }
}

function mergeSplitManagedValues(snapshot: SiteSettingsSnapshot): SiteSettingsRecord {
  return {
    ...SITE_SETTINGS_CLEAR_LEGACY_VALUES,
    ...snapshot.themeValues,
    ...snapshot.scheduleValues,
    ...snapshot.rulesValues,
  }
}

function mergeCategoryManagedValues(snapshot: SiteSettingsSnapshot): SiteSettingsRecord | null {
  if (snapshot.migration.migrationState === 'legacy') {
    return snapshot.legacySiteConfigRow
      ? normalizeSiteConfigShape(snapshot.legacySiteConfigRow)
      : null
  }

  if (!snapshot.coreSiteConfigRow) {
    return null
  }

  return normalizeSiteConfigShape({
    id: SITE_SETTINGS_SITE_CONFIG_ID,
    ...pickSiteConfigBodyFields(snapshot.coreSiteConfigRow),
    ...mergeSplitManagedValues(snapshot),
  })
}

export async function readSiteSettingsSnapshot(executor: any = db): Promise<SiteSettingsSnapshot> {
  const [
    legacySiteConfigRow,
    coreSiteConfigRow,
    migrationMetaRow,
    themeSnapshot,
    scheduleSnapshot,
    rulesSnapshot,
  ] = await Promise.all([
    readLegacySiteConfigRow(executor),
    readSiteConfigV2Record(executor),
    readMigrationMetaRow(executor),
    readThemeSettingsSnapshot(executor),
    readScheduleSettingsSnapshot(executor),
    readRulesSettingsSnapshot(executor),
  ])

  const hasPersistedV2Data =
    coreSiteConfigRow !== null ||
    themeSnapshot.rowCount > 0 ||
    scheduleSnapshot.rowCount > 0 ||
    rulesSnapshot.rowCount > 0

  return {
    legacySiteConfigRow,
    coreSiteConfigRow,
    migration: normalizeMigrationSnapshot(
      migrationMetaRow,
      legacySiteConfigRow,
      hasPersistedV2Data,
    ),
    themeValues: themeSnapshot.values,
    themeRowCount: themeSnapshot.rowCount,
    scheduleValues: scheduleSnapshot.values,
    scheduleRowCount: scheduleSnapshot.rowCount,
    rulesValues: rulesSnapshot.values,
    rulesRowCount: rulesSnapshot.rowCount,
  }
}

export async function readEffectiveSiteConfig(
  executor: any = db,
): Promise<SiteSettingsRecord | null> {
  return mergeCategoryManagedValues(await readSiteSettingsSnapshot(executor))
}

export async function readSiteSettingsMigrationSnapshot(
  executor: any = db,
): Promise<SiteSettingsMigrationSnapshot> {
  return (await readSiteSettingsSnapshot(executor)).migration
}

export function serializeSiteSettingsMigrationSnapshot(
  snapshot: SiteSettingsMigrationSnapshot,
): Record<string, unknown> {
  const toIso = (value: unknown) => {
    if (value instanceof Date) return value.toISOString()
    if (typeof value === 'string' && value.trim().length > 0) return value
    return null
  }

  return {
    siteConfigId: snapshot.siteConfigId,
    migrationState: snapshot.migrationState,
    migratedAt: toIso(snapshot.migratedAt),
    legacyDataClearedAt: toIso(snapshot.legacyDataClearedAt),
    legacyDataPresent: snapshot.legacyDataPresent,
    stateInferred: snapshot.stateInferred,
    coveredCategories: ['core', ...SITE_SETTINGS_COVERED_CATEGORIES],
    canMigrate: snapshot.migrationState === 'legacy',
    canClearLegacyData:
      snapshot.migrationState === 'migrated' && snapshot.legacyDataPresent === true,
    heavyEditingLocked: snapshot.migrationState === 'legacy',
  }
}

export function pickThemeSettingsFromConfig(
  config: SiteSettingsRecord,
): Record<string, unknown> {
  return pickRecordKeys(config, SITE_SETTINGS_THEME_CATEGORY_KEYS)
}

export function pickScheduleSettingsFromConfig(
  config: SiteSettingsRecord,
): Record<string, unknown> {
  return pickRecordKeys(config, SITE_SETTINGS_SCHEDULE_CATEGORY_KEYS)
}

export function pickRulesSettingsFromConfig(
  config: SiteSettingsRecord,
): Record<string, unknown> {
  return pickRecordKeys(config, SITE_SETTINGS_RULES_KEYS)
}

export function pickCoreSettingsFromConfig(
  config: SiteSettingsRecord,
): Record<string, unknown> {
  return omitRecordKeys(pickSiteConfigBodyFields(config), [
    ...SITE_SETTINGS_THEME_CATEGORY_KEYS,
    ...SITE_SETTINGS_SCHEDULE_CATEGORY_KEYS,
    ...SITE_SETTINGS_RULES_KEYS,
  ])
}
