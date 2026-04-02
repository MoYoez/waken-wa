import { and, eq, inArray, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { inspirationAssets, inspirationEntries, siteConfig } from '@/lib/drizzle-schema'
import {
  extractInspirationImagePublicKeysFromText,
  inspirationInlineImageUrl,
} from '@/lib/inspiration-inline-images'
import { extractInspirationImagePublicKeysFromLexical } from '@/lib/inspiration-lexical'
import { coerceDbTimestampToIsoUtc } from '@/lib/timezone'

export function toInspirationAssetDate(value: unknown): Date | null {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value !== 'string') return null

  const date = new Date(coerceDbTimestampToIsoUtc(value))
  return Number.isFinite(date.getTime()) ? date : null
}

export function normalizeInspirationAssetPublicKeys(publicKeys: unknown[]) {
  return [...new Set(publicKeys.map((item) => String(item ?? '').trim().toLowerCase()))]
    .filter((item) => item.length > 0)
}

export function buildInspirationOrphanAssetRecord(
  row: { publicKey: string; createdAt: unknown },
  referencedKeys: Set<string>,
  nowMs: number,
) {
  const publicKey = String(row.publicKey).trim().toLowerCase()
  const createdAt = toInspirationAssetDate(row.createdAt)
  const ageMinutes = createdAt
    ? Math.max(0, Math.floor((nowMs - createdAt.getTime()) / 60000))
    : null
  const referenced = referencedKeys.has(publicKey)
  const eligibleForDelete = !referenced

  return {
    publicKey,
    url: inspirationInlineImageUrl(publicKey),
    createdAt: createdAt ? createdAt.toISOString() : null,
    ageMinutes,
    eligibleForDelete,
    referenced,
  }
}

export async function scanReferencedInspirationAssetPublicKeys() {
  const keys = new Set<string>()

  const entryRows = await db
    .select({
      title: inspirationEntries.title,
      content: inspirationEntries.content,
      contentLexical: inspirationEntries.contentLexical,
      statusSnapshot: inspirationEntries.statusSnapshot,
    })
    .from(inspirationEntries)

  for (const row of entryRows) {
    if (typeof row.title === 'string' && row.title.length > 0) {
      for (const key of extractInspirationImagePublicKeysFromText(row.title)) keys.add(key)
    }
    if (typeof row.content === 'string' && row.content.length > 0) {
      for (const key of extractInspirationImagePublicKeysFromText(row.content)) keys.add(key)
    }
    for (const key of extractInspirationImagePublicKeysFromLexical(row.contentLexical)) keys.add(key)
    if (typeof row.statusSnapshot === 'string' && row.statusSnapshot.length > 0) {
      for (const key of extractInspirationImagePublicKeysFromText(row.statusSnapshot)) keys.add(key)
    }
  }

  const [cfg] = await db.select().from(siteConfig).where(eq(siteConfig.id, 1)).limit(1)
  if (cfg) {
    for (const value of Object.values(cfg)) {
      if (typeof value !== 'string' || value.length === 0) continue
      for (const key of extractInspirationImagePublicKeysFromText(value)) keys.add(key)
    }
  }

  return keys
}

export async function listDeletableInspirationOrphanAssetKeys(keys: string[]) {
  const rows = await db
    .select({
      publicKey: inspirationAssets.publicKey,
    })
    .from(inspirationAssets)
    .where(
      and(
        isNull(inspirationAssets.inspirationEntryId),
        inArray(inspirationAssets.publicKey as any, keys),
      ),
    )

  return new Set(rows.map((row: { publicKey: string }) => String(row.publicKey).toLowerCase()))
}
