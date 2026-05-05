import 'server-only'

import { createHash } from 'crypto'
import { and, desc, eq } from 'drizzle-orm'
import sharp from 'sharp'

import { db } from '@/lib/db'
import { mediaCovers } from '@/lib/drizzle-schema'
import { sqlTimestamp } from '@/lib/sql-timestamp'

const MAX_COVER_COUNT = 50
const COVER_RESIZE_MAX = 256

export type MediaCoverInfo = {
  hash: string
  url: string
  size: number
  createdAt: string
}

export type MediaCoverPayload = {
  mimeType: string
  buffer: Buffer
}

function mediaCoverUrl(deviceHashKey: string, coverHash: string): string {
  return `/api/media/covers/${encodeURIComponent(deviceHashKey)}/${encodeURIComponent(coverHash)}`
}

function parseDataImagePayload(dataUrl: string): { mime: string; buffer: Buffer } | null {
  const raw = dataUrl.trim().replace(/\s/g, '')
  const m = /^data:([^;]+);base64,(.+)$/i.exec(raw)
  if (!m) return null
  const mime = m[1].trim().toLowerCase()
  try {
    const buffer = Buffer.from(m[2], 'base64')
    if (!buffer.length) return null
    return { mime, buffer }
  } catch {
    return null
  }
}

async function parseCoverDataUrlAsync(dataUrl: string): Promise<{
  hash: string
  mimeType: string
  base64Data: string
  buffer: Buffer
} | null> {
  const parsed = parseDataImagePayload(dataUrl)
  if (!parsed) return null

  const resized = await resizeCoverImageAsync(parsed.buffer, parsed.mime)
  const base64Data = resized.buffer.toString('base64')
  const hash = createHash('sha256')
    .update(parsed.mime)
    .update('\0')
    .update(base64Data)
    .digest('hex')
    .slice(0, 16)

  return {
    hash,
    mimeType: resized.mimeType,
    base64Data,
    buffer: resized.buffer,
  }
}

/**
 * Resize cover image to max 256x256, maintaining aspect ratio.
 * Outputs JPEG for consistent format and smaller size.
 */
async function resizeCoverImageAsync(
  inputBuffer: Buffer,
  _originalMime: string,
): Promise<{ buffer: Buffer; mimeType: string }> {
  try {
    const image = sharp(inputBuffer)
    const metadata = await image.metadata()
    if (!metadata.width || !metadata.height) {
      const output = await image.jpeg({ quality: 85 }).toBuffer()
      return { buffer: output, mimeType: 'image/jpeg' }
    }

    if (metadata.width <= COVER_RESIZE_MAX && metadata.height <= COVER_RESIZE_MAX) {
      const output = await image.jpeg({ quality: 85 }).toBuffer()
      return { buffer: output, mimeType: 'image/jpeg' }
    }

    const output = await image
      .resize(COVER_RESIZE_MAX, COVER_RESIZE_MAX, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer()
    return { buffer: output, mimeType: 'image/jpeg' }
  } catch {
    return { buffer: inputBuffer, mimeType: 'image/jpeg' }
  }
}

async function enforceMaxCoverCount(deviceId: number, maxCoverCount: number): Promise<void> {
  if (maxCoverCount <= 0) return

  const rows = await db
    .select({ id: mediaCovers.id })
    .from(mediaCovers)
    .where(eq(mediaCovers.deviceId, deviceId))
    .orderBy(desc(mediaCovers.updatedAt))

  const staleRows = rows.slice(maxCoverCount)
  for (const row of staleRows) {
    await db.delete(mediaCovers).where(eq(mediaCovers.id, row.id))
  }
}

/**
 * Save a cover image from a base64 data URL into the database.
 * Returns the hash and API URL path.
 */
export async function saveCoverFromDataUrl(
  deviceId: number,
  deviceHashKey: string,
  dataUrl: string,
  maxCoverCount: number = MAX_COVER_COUNT,
  baseUrl: string = '',
): Promise<MediaCoverInfo | null> {
  const parsed = await parseCoverDataUrlAsync(dataUrl)
  if (!parsed) return null

  const now = sqlTimestamp()
  await db
    .insert(mediaCovers)
    .values({
      deviceId,
      generatedHashKey: deviceHashKey,
      coverHash: parsed.hash,
      mimeType: parsed.mimeType,
      base64Data: parsed.base64Data,
      sizeBytes: parsed.buffer.length,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [mediaCovers.deviceId, mediaCovers.coverHash],
      set: {
        generatedHashKey: deviceHashKey,
        mimeType: parsed.mimeType,
        base64Data: parsed.base64Data,
        sizeBytes: parsed.buffer.length,
        updatedAt: now,
      },
    })

  await enforceMaxCoverCount(deviceId, maxCoverCount)

  const coverUrl = mediaCoverUrl(deviceHashKey, parsed.hash)
  return {
    hash: parsed.hash,
    url: baseUrl ? `${baseUrl.replace(/\/+$/, '')}${coverUrl}` : coverUrl,
    size: parsed.buffer.length,
    createdAt: new Date().toISOString(),
  }
}

/**
 * Get cover image content by device hash and cover hash.
 */
export async function getCoverPayload(
  deviceHashKey: string,
  coverHash: string,
): Promise<MediaCoverPayload | null> {
  const [row] = await db
    .select({
      mimeType: mediaCovers.mimeType,
      base64Data: mediaCovers.base64Data,
    })
    .from(mediaCovers)
    .where(
      and(
        eq(mediaCovers.generatedHashKey, deviceHashKey),
        eq(mediaCovers.coverHash, coverHash),
      ),
    )
    .limit(1)

  if (!row?.mimeType || !row?.base64Data) return null

  try {
    const buffer = Buffer.from(row.base64Data, 'base64')
    if (!buffer.length) return null
    return { mimeType: row.mimeType, buffer }
  } catch {
    return null
  }
}
