import 'server-only'

import { createHash } from 'node:crypto'

import { eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { imageSources } from '@/lib/drizzle-schema'
import { sqlTimestamp } from '@/lib/sql-timestamp'

export const IMAGE_SOURCE_ROUTE_PREFIX = '/api/image-src/'

export function isInlineImageDataUrl(value: unknown): value is string {
  return typeof value === 'string' && /^data:image\//i.test(value.trim())
}

export function imageSourceUrl(publicKey: string): string {
  return `${IMAGE_SOURCE_ROUTE_PREFIX}${publicKey}`
}

export function extractImageSourcePublicKey(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  if (!normalized.startsWith(IMAGE_SOURCE_ROUTE_PREFIX)) return null
  const key = normalized.slice(IMAGE_SOURCE_ROUTE_PREFIX.length).split(/[?#/]/)[0]?.trim()
  return key && /^[0-9a-f-]{16,64}$/i.test(key) ? key : null
}

function hashImageDataUrl(dataUrl: string): string {
  return createHash('sha256').update(dataUrl.trim()).digest('hex')
}

function normalizeRow(row: unknown): Record<string, unknown> | null {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null
  return row as Record<string, unknown>
}

async function selectImageSourceByHash(
  contentHash: string,
  executor: any,
): Promise<Record<string, unknown> | null> {
  const rows = await executor
    .select()
    .from(imageSources)
    .where(eq(imageSources.contentHash, contentHash))
    .limit(1)
  return normalizeRow(rows[0])
}

async function selectImageSourceByUsageKey(
  usageKey: string,
  executor: any,
): Promise<Record<string, unknown> | null> {
  const rows = await executor
    .select()
    .from(imageSources)
    .where(eq(imageSources.usageKey, usageKey))
    .limit(1)
  return normalizeRow(rows[0])
}

async function selectImageSourceByPublicKey(
  publicKey: string,
  executor: any,
): Promise<Record<string, unknown> | null> {
  const rows = await executor
    .select()
    .from(imageSources)
    .where(eq(imageSources.publicKey, publicKey))
    .limit(1)
  return normalizeRow(rows[0])
}

export async function upsertImageSourceFromDataUrl(
  dataUrl: string,
  options?: { usageKey?: string | null },
  executor: any = db,
): Promise<string> {
  const normalized = dataUrl.trim()
  const contentHash = hashImageDataUrl(normalized)
  const usageKey = typeof options?.usageKey === 'string' ? options.usageKey.trim() : ''
  if (usageKey) {
    const existingByUsage = await selectImageSourceByUsageKey(usageKey, executor)
    if (typeof existingByUsage?.publicKey === 'string' && existingByUsage.publicKey.trim()) {
      await executor
        .update(imageSources)
        .set({
          contentHash,
          imageDataUrl: normalized,
          updatedAt: sqlTimestamp(),
        } as never)
        .where(eq(imageSources.usageKey, usageKey))
      return imageSourceUrl(existingByUsage.publicKey.trim())
    }

    const now = sqlTimestamp()
    await executor
      .insert(imageSources)
      .values({
        usageKey,
        contentHash,
        imageDataUrl: normalized,
        createdAt: now,
        updatedAt: now,
      } as never)
      .onConflictDoNothing()

    const row = await selectImageSourceByUsageKey(usageKey, executor)
    const publicKey = typeof row?.publicKey === 'string' ? row.publicKey.trim() : ''
    if (!publicKey) {
      throw new Error('Failed to save image source')
    }
    return imageSourceUrl(publicKey)
  }

  const existing = await selectImageSourceByHash(contentHash, executor)
  if (typeof existing?.publicKey === 'string' && existing.publicKey.trim()) {
    return imageSourceUrl(existing.publicKey.trim())
  }

  const now = sqlTimestamp()
  await executor
    .insert(imageSources)
    .values({
      usageKey: usageKey || null,
      contentHash,
      imageDataUrl: normalized,
      createdAt: now,
      updatedAt: now,
    } as never)
    .onConflictDoNothing()

  const row = await selectImageSourceByHash(contentHash, executor)
  const publicKey = typeof row?.publicKey === 'string' ? row.publicKey.trim() : ''
  if (!publicKey) {
    throw new Error('Failed to save image source')
  }
  return imageSourceUrl(publicKey)
}

export async function readImageSourceDataUrl(
  publicKey: string,
  executor: any = db,
): Promise<string | null> {
  const row = await selectImageSourceByPublicKey(publicKey, executor)
  return typeof row?.imageDataUrl === 'string' ? row.imageDataUrl : null
}
