import { db } from '@/lib/db'
import { siteConfig } from '@/lib/drizzle-schema'
import { clearSiteConfigCaches } from '@/lib/site-config-cache'
import { normalizeJsonFieldsForDb } from '@/lib/sqlite-json'
import { sqlTimestamp } from '@/lib/sql-timestamp'

type SiteConfigUpsertArgs = {
  where: { id: number }
  update: Record<string, unknown>
  create: Record<string, unknown>
}

const SITE_CONFIG_JSON_FIELDS = [
  'userNoteHitokotoCategories',
  'themeCustomSurface',
  'appMessageRules',
  'appBlacklist',
  'appWhitelist',
  'appNameOnlyList',
  'mediaPlaySourceBlocklist',
  'inspirationAllowedDeviceHashes',
  'schedulePeriodTemplate',
  'scheduleGridByWeekday',
  'scheduleCourses',
] as const

function getSqliteUnknownColumnName(error: unknown): string | null {
  const message = String((error as { message?: unknown })?.message ?? '')
  const m = message.match(/no such column:\s*(\S+)/i)
  return m?.[1] ?? null
}

function getPostgresUndefinedColumnName(error: unknown): string | null {
  const message = String((error as { message?: unknown })?.message ?? '')
  const m = message.match(/column\s+"([^"]+)"\s+of relation/i)
  return m?.[1] ?? null
}

function getUnknownColumnName(error: unknown): string | null {
  return getSqliteUnknownColumnName(error) ?? getPostgresUndefinedColumnName(error)
}

/**
 * Upsert site_config by primary key. Retries without unknown columns when the DB is behind the app schema.
 */
export async function safeSiteConfigUpsert(
  args: SiteConfigUpsertArgs,
  executor: any = db,
) {
  const id = args.where.id
  const now = sqlTimestamp()
  const update: Record<string, unknown> = normalizeJsonFieldsForDb(
    { ...args.update, updatedAt: now },
    SITE_CONFIG_JSON_FIELDS,
  )
  const create: Record<string, unknown> = normalizeJsonFieldsForDb(
    { ...args.create, id, updatedAt: now },
    SITE_CONFIG_JSON_FIELDS,
  )
  const strippedColumns = new Set<string>()

  for (let i = 0; i < 30; i += 1) {
    try {
      await executor
        .insert(siteConfig)
        .values(create as never)
        .onConflictDoUpdate({
          target: siteConfig.id,
          set: update as never,
        })
      await clearSiteConfigCaches()
      return { strippedColumns: Array.from(strippedColumns) }
    } catch (error) {
      const unknownCol = getUnknownColumnName(error)
      if (!unknownCol) {
        throw error
      }

      const camel = snakeToCamel(unknownCol)
      const keysToStrip = new Set([unknownCol, camel])
      let stripped = false
      for (const k of keysToStrip) {
        if (Object.prototype.hasOwnProperty.call(update, k)) {
          delete update[k]
          stripped = true
        }
        if (Object.prototype.hasOwnProperty.call(create, k)) {
          delete create[k]
          stripped = true
        }
      }

      if (!stripped) {
        throw error
      }
      strippedColumns.add(unknownCol)
    }
  }

  throw new Error('siteConfig upsert retries exhausted')
}

function snakeToCamel(snake: string): string {
  return snake.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
}
