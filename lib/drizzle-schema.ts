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
export const systemSecrets = usePg ? pg.systemSecrets : sqlite.systemSecrets
export const rateLimitBackups = usePg ? pg.rateLimitBackups : sqlite.rateLimitBackups
export const inspirationEntries = usePg ? pg.inspirationEntries : sqlite.inspirationEntries
export const inspirationAssets = usePg ? pg.inspirationAssets : sqlite.inspirationAssets

export const appSchema = usePg ? pg.pgSchema : sqlite.sqliteSchema
