/**
 * Helpers for `metadata.media` on activity logs: now-playing title + optional singer.
 * Clients POST `metadata: { media: { title?: string, singer?: string } }` to `/api/activity`.
 */

const MEDIA_FIELD_MAX_LEN = 200

function clampField(value: string): string {
  if (value.length <= MEDIA_FIELD_MAX_LEN) return value
  return `${value.slice(0, MEDIA_FIELD_MAX_LEN)}…`
}

export interface MediaDisplay {
  title: string
  singer: string | null
}

/**
 * Returns display payload when `metadata.media.title` is non-empty after trim.
 * Singer is optional; title-only is valid.
 */
export function getMediaDisplay(metadata: unknown): MediaDisplay | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  const media = (metadata as Record<string, unknown>).media
  if (!media || typeof media !== 'object' || Array.isArray(media)) return null
  const m = media as Record<string, unknown>
  const titleRaw = m.title
  if (typeof titleRaw !== 'string') return null
  const title = clampField(titleRaw.trim())
  if (!title) return null
  const singerRaw = m.singer
  let singer: string | null = null
  if (typeof singerRaw === 'string') {
    const s = clampField(singerRaw.trim())
    if (s) singer = s
  }
  return { title, singer }
}

/**
 * Shallow-merge patch into existing metadata; `media` is merged one level deep when both are plain objects.
 */
export function mergeActivityMetadata(
  existing: Record<string, unknown> | null | undefined,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const base = existing && typeof existing === 'object' && !Array.isArray(existing) ? { ...existing } : {}
  const merged: Record<string, unknown> = { ...base, ...patch }
  const baseMedia = base.media
  const patchMedia = patch.media
  if (
    baseMedia &&
    typeof baseMedia === 'object' &&
    !Array.isArray(baseMedia) &&
    patchMedia &&
    typeof patchMedia === 'object' &&
    !Array.isArray(patchMedia)
  ) {
    merged.media = {
      ...(baseMedia as Record<string, unknown>),
      ...(patchMedia as Record<string, unknown>),
    }
  }
  return merged
}
