import 'server-only'

import { eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { siteConfig, siteConfigV2Entries } from '@/lib/drizzle-schema'
import { parseJsonString } from '@/lib/json-parse'
import { normalizeJsonFieldsForDb } from '@/lib/sqlite-json'
import { sqlTimestamp } from '@/lib/sql-timestamp'

type SiteConfigRecord = Record<string, unknown>
type SiteConfigV2ValueKind = 'string' | 'number' | 'boolean' | 'json' | 'null'

const SITE_CONFIG_ROOT_ID = 1
const SITE_CONFIG_META_KEYS = new Set(['id', 'createdAt', 'updatedAt'])

function toRecord(value: unknown): SiteConfigRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  return value as SiteConfigRecord
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

function isMissingSiteConfigV2TableError(error: unknown): boolean {
  const tableName = (getSqliteMissingTable(error) ?? getPostgresMissingTable(error) ?? '')
    .trim()
    .replace(/^["']|["']$/g, '')
  return tableName === 'site_config_v2_entries'
}

export function pickSiteConfigBodyFields(record: SiteConfigRecord): SiteConfigRecord {
  const next: SiteConfigRecord = {}
  for (const [key, value] of Object.entries(record)) {
    if (SITE_CONFIG_META_KEYS.has(key)) continue
    next[key] = value
  }
  return next
}

function encodeSiteConfigV2EntryValue(
  value: unknown,
): Omit<
  {
    valueKind: SiteConfigV2ValueKind
    stringValue?: string | null
    numberValue?: number | null
    booleanValue?: boolean | null
    jsonValue?: unknown
  },
  never
> {
  if (value === null) {
    return { valueKind: 'null' }
  }
  if (typeof value === 'string') {
    return { valueKind: 'string', stringValue: value }
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { valueKind: 'number', numberValue: value }
  }
  if (typeof value === 'boolean') {
    return { valueKind: 'boolean', booleanValue: value }
  }
  if (value instanceof Date) {
    return { valueKind: 'string', stringValue: value.toISOString() }
  }
  return { valueKind: 'json', jsonValue: value }
}

function decodeSiteConfigV2EntryValue(row: SiteConfigRecord): unknown {
  const valueKind = String(row.valueKind ?? '').trim().toLowerCase()
  if (valueKind === 'null') return null
  if (valueKind === 'string') return typeof row.stringValue === 'string' ? row.stringValue : ''
  if (valueKind === 'number') {
    const value = Number(row.numberValue)
    return Number.isFinite(value) ? value : null
  }
  if (valueKind === 'boolean') return row.booleanValue === true
  return parseJsonString(row.jsonValue)
}

function buildSiteConfigV2EntryRows(values: SiteConfigRecord): SiteConfigRecord[] {
  const now = sqlTimestamp()
  return Object.entries(values)
    .filter(([key, value]) => !SITE_CONFIG_META_KEYS.has(key) && value !== undefined)
    .map(([settingKey, value]) =>
      normalizeJsonFieldsForDb(
        {
          siteConfigId: SITE_CONFIG_ROOT_ID,
          settingKey,
          ...encodeSiteConfigV2EntryValue(value),
          createdAt: now,
          updatedAt: now,
        },
        ['jsonValue'],
      ),
    )
}

function composeSiteConfigRecordFromV2Rows(rows: SiteConfigRecord[]): SiteConfigRecord {
  const record: SiteConfigRecord = {}
  for (const row of rows) {
    const settingKey = String(row.settingKey ?? '').trim()
    if (!settingKey) continue
    record[settingKey] = decodeSiteConfigV2EntryValue(row)
  }
  return record
}

export async function readLegacySiteConfigRow(executor: any = db): Promise<SiteConfigRecord | null> {
  const rows = await executor.select().from(siteConfig).where(eq(siteConfig.id, SITE_CONFIG_ROOT_ID)).limit(1)
  return toRecord(rows[0])
}

async function readSiteConfigV2Rows(executor: any = db): Promise<SiteConfigRecord[] | null> {
  try {
    const rows = await executor
      .select()
      .from(siteConfigV2Entries)
      .where(eq(siteConfigV2Entries.siteConfigId, SITE_CONFIG_ROOT_ID))
    return rows
      .map((row: unknown) => toRecord(row))
      .filter((row: SiteConfigRecord | null): row is SiteConfigRecord => row !== null)
  } catch (error) {
    if (isMissingSiteConfigV2TableError(error)) {
      return null
    }
    throw error
  }
}

export async function upsertSiteConfigV2Entries(
  values: SiteConfigRecord,
  executor: any = db,
): Promise<boolean> {
  const rows = buildSiteConfigV2EntryRows(values)
  if (rows.length === 0) return true

  try {
    for (const row of rows) {
      await executor
        .insert(siteConfigV2Entries)
        .values(row as never)
        .onConflictDoUpdate({
          target: [siteConfigV2Entries.siteConfigId, siteConfigV2Entries.settingKey],
          set: normalizeJsonFieldsForDb(
            {
              valueKind: row.valueKind,
              stringValue: row.stringValue ?? null,
              numberValue: row.numberValue ?? null,
              booleanValue: row.booleanValue ?? null,
              jsonValue: row.jsonValue ?? null,
              updatedAt: row.updatedAt,
            },
            ['jsonValue'],
          ) as never,
        })
    }
    return true
  } catch (error) {
    if (isMissingSiteConfigV2TableError(error)) {
      return false
    }
    throw error
  }
}

export async function readSiteConfigV2Record(executor: any = db): Promise<SiteConfigRecord | null> {
  const v2Rows = await readSiteConfigV2Rows(executor)

  if (v2Rows === null) {
    return null
  }
  if (v2Rows.length === 0) {
    return null
  }

  return {
    id: SITE_CONFIG_ROOT_ID,
    ...composeSiteConfigRecordFromV2Rows(v2Rows),
  }
}

export function mergeSiteConfigForV2Write(
  createValues: SiteConfigRecord,
  updateValues: SiteConfigRecord,
): SiteConfigRecord {
  return pickSiteConfigBodyFields({
    ...createValues,
    ...updateValues,
  })
}
