/**
 * Markdown references to stored inspiration inline images (see InspirationAsset).
 */
import { and, eq, inArray, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { inspirationAssets } from '@/lib/drizzle-schema'
import { extractInspirationImagePublicKeysFromLexical } from '@/lib/inspiration-lexical'

export const INSPIRATION_IMG_URL_PREFIX = '/api/inspiration/img/'
const INSPIRATION_ENTRY_IMG_URL_PREFIX = '/api/inspiration/entry-img/'
const ALLOWED_INLINE_IMAGE_MIME_TYPES = new Set([
  'image/avif',
  'image/bmp',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
])

const UUID_IN_PATH_RE =
  /\/api\/inspiration\/img\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi

type InspirationImageUrlOptions = {
  format?: 'avif' | 'jpeg' | 'png' | 'webp'
  quality?: number
  width?: number
}

function appendImageUrlOptions(path: string, options?: InspirationImageUrlOptions): string {
  if (!options) return path
  const params = new URLSearchParams()
  if (Number.isFinite(options.width)) params.set('w', String(Math.round(options.width as number)))
  if (Number.isFinite(options.quality)) params.set('q', String(Math.round(options.quality as number)))
  if (options.format) params.set('format', options.format)
  const query = params.toString()
  return query ? `${path}?${query}` : path
}

export function extractInspirationImagePublicKeysFromText(input: string): string[] {
  const keys = new Set<string>()
  let m: RegExpExecArray | null
  const re = new RegExp(UUID_IN_PATH_RE.source, 'gi')
  while ((m = re.exec(input)) !== null) {
    keys.add(m[1].toLowerCase())
  }
  return [...keys]
}

export function extractInspirationImagePublicKeysFromMarkdown(markdown: string): string[] {
  return extractInspirationImagePublicKeysFromText(markdown)
}

export function inspirationInlineImageUrl(
  publicKey: string,
  options?: InspirationImageUrlOptions,
): string {
  return appendImageUrlOptions(`${INSPIRATION_IMG_URL_PREFIX}${publicKey}`, options)
}

export function inspirationEntryImageUrl(
  entryId: number,
  options?: InspirationImageUrlOptions,
): string {
  return appendImageUrlOptions(`${INSPIRATION_ENTRY_IMG_URL_PREFIX}${entryId}`, options)
}

export function extractInspirationEntryIdFromImageUrl(input: string): number | null {
  const trimmed = String(input ?? '').trim()
  if (!trimmed) return null
  const match = /\/api\/inspiration\/entry-img\/(\d+)(?:[/?#]|$)/i.exec(trimmed)
  const id = Number.parseInt(String(match?.[1] ?? ''), 10)
  return Number.isFinite(id) && id > 0 ? id : null
}

export function parseDataImagePayload(dataUrl: string): { mime: string; buffer: Buffer } | null {
  const raw = dataUrl.trim().replace(/\s/g, '')
  const m = /^data:([^;]+);base64,(.+)$/i.exec(raw)
  if (!m) return null
  const mime = m[1].trim().toLowerCase()
  if (!ALLOWED_INLINE_IMAGE_MIME_TYPES.has(mime)) return null
  try {
    const buffer = Buffer.from(m[2], 'base64')
    if (!buffer.length) return null
    return { mime, buffer }
  } catch {
    return null
  }
}

const MAX_INLINE_IMAGE_BYTES = 6 * 1024 * 1024

export function validateInlineImageDataUrl(dataUrl: string): { ok: true } | { ok: false; error: string } {
  const parsed = parseDataImagePayload(dataUrl)
  if (!parsed) {
    return {
      ok: false,
      error: 'Invalid image data URL or unsupported image type (allowed: PNG, JPEG, GIF, WebP, AVIF, BMP)',
    }
  }
  if (parsed.buffer.length > MAX_INLINE_IMAGE_BYTES) {
    return { ok: false, error: `Image too large (max ${MAX_INLINE_IMAGE_BYTES / (1024 * 1024)}MB)` }
  }
  return { ok: true }
}

export function extractInspirationPublicKeyFromUrl(input: string): string | null {
  const trimmed = String(input ?? '').trim()
  if (!trimmed) return null
  const match = new RegExp(`${INSPIRATION_IMG_URL_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([0-9a-f-]{36})`, 'i').exec(trimmed)
  const publicKey = String(match?.[1] ?? '').trim().toLowerCase()
  return publicKey || null
}

/** Attach unlinked assets referenced in markdown to a newly created inspiration entry. */
export async function linkInspirationAssetsToEntry(
  entryId: number,
  content: string,
  contentLexical?: string | null,
): Promise<void> {
  const keys = new Set<string>(extractInspirationImagePublicKeysFromMarkdown(content))
  for (const key of extractInspirationImagePublicKeysFromLexical(contentLexical)) {
    keys.add(key)
  }
  const mergedKeys = [...keys]
  if (mergedKeys.length === 0) return
  await db
    .update(inspirationAssets)
    .set({ inspirationEntryId: entryId })
    .where(and(inArray(inspirationAssets.publicKey, mergedKeys), isNull(inspirationAssets.inspirationEntryId)))
}

/** Re-sync asset ownership when editing an existing inspiration entry. */
export async function syncInspirationAssetsForEntry(
  entryId: number,
  content: string,
  contentLexical?: string | null,
): Promise<void> {
  await db
    .update(inspirationAssets)
    .set({ inspirationEntryId: null })
    .where(eq(inspirationAssets.inspirationEntryId, entryId))

  await linkInspirationAssetsToEntry(entryId, content, contentLexical)
}
