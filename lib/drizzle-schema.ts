import 'server-only'

import * as pg from '@/drizzle/schema.pg'
import * as sqlite from '@/drizzle/schema.sqlite'
import { isPostgresConnectionUrl } from '@/lib/db-env'

const usePg = isPostgresConnectionUrl(process.env.DATABASE_URL?.trim())

export const adminUsers = usePg ? pg.adminUsers : sqlite.adminUsers
export const apiTokens = usePg ? pg.apiTokens : sqlite.apiTokens
export const devices = usePg ? pg.devices : sqlite.devices
export const userActivities = usePg ? pg.userActivities : sqlite.userActivities
export const siteConfig = usePg ? pg.siteConfig : sqlite.siteConfig
export const siteConfigV2Entries = usePg ? pg.siteConfigV2Entries : sqlite.siteConfigV2Entries
export const siteSettingsMigrationMeta = usePg
  ? pg.siteSettingsMigrationMeta
  : sqlite.siteSettingsMigrationMeta
export const siteSettingsV2ValueEntries = usePg
  ? pg.siteSettingsV2ValueEntries
  : sqlite.siteSettingsV2ValueEntries
export const siteSettingsV2ListEntries = usePg
  ? pg.siteSettingsV2ListEntries
  : sqlite.siteSettingsV2ListEntries
export const siteSettingsV2ThemeCustomSurface = usePg
  ? pg.siteSettingsV2ThemeCustomSurface
  : sqlite.siteSettingsV2ThemeCustomSurface
export const siteSettingsV2ThemeCustomSurfaceImagePool = usePg
  ? pg.siteSettingsV2ThemeCustomSurfaceImagePool
  : sqlite.siteSettingsV2ThemeCustomSurfaceImagePool
export const siteSettingsV2ThemePublicFontOptions = usePg
  ? pg.siteSettingsV2ThemePublicFontOptions
  : sqlite.siteSettingsV2ThemePublicFontOptions
export const siteSettingsV2SchedulePeriods = usePg
  ? pg.siteSettingsV2SchedulePeriods
  : sqlite.siteSettingsV2SchedulePeriods
export const siteSettingsV2ScheduleGridDays = usePg
  ? pg.siteSettingsV2ScheduleGridDays
  : sqlite.siteSettingsV2ScheduleGridDays
export const siteSettingsV2ScheduleCourses = usePg
  ? pg.siteSettingsV2ScheduleCourses
  : sqlite.siteSettingsV2ScheduleCourses
export const siteSettingsV2ScheduleCourseTimeSessions = usePg
  ? pg.siteSettingsV2ScheduleCourseTimeSessions
  : sqlite.siteSettingsV2ScheduleCourseTimeSessions
export const siteSettingsV2ScheduleCoursePeriodIds = usePg
  ? pg.siteSettingsV2ScheduleCoursePeriodIds
  : sqlite.siteSettingsV2ScheduleCoursePeriodIds
export const siteSettingsV2RuleGroups = usePg
  ? pg.siteSettingsV2RuleGroups
  : sqlite.siteSettingsV2RuleGroups
export const siteSettingsV2RuleTitleRules = usePg
  ? pg.siteSettingsV2RuleTitleRules
  : sqlite.siteSettingsV2RuleTitleRules
export const activityAppHistory = usePg ? pg.activityAppHistory : sqlite.activityAppHistory
export const activityPlaySourceHistory = usePg
  ? pg.activityPlaySourceHistory
  : sqlite.activityPlaySourceHistory
export const systemSecrets = usePg ? pg.systemSecrets : sqlite.systemSecrets
export const skillsOauthTokens = usePg ? pg.skillsOauthTokens : sqlite.skillsOauthTokens
export const skillsOauthAuthorizeCodes = usePg
  ? pg.skillsOauthAuthorizeCodes
  : sqlite.skillsOauthAuthorizeCodes
export const rateLimitBackups = usePg ? pg.rateLimitBackups : sqlite.rateLimitBackups
export const inspirationEntries = usePg ? pg.inspirationEntries : sqlite.inspirationEntries
export const inspirationAssets = usePg ? pg.inspirationAssets : sqlite.inspirationAssets

export const appSchema = usePg ? pg.pgSchema : sqlite.sqliteSchema
