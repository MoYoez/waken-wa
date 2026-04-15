import type { MediaDisplay } from '@/types/activity-media'

export type { MediaDisplay } from '@/types/activity-media'

/** Parse `metadata.media` from POST /api/activity. */
const MEDIA_FIELD_MAX_LEN = 200

function clampField(value: string): string {
  if (value.length <= MEDIA_FIELD_MAX_LEN) return value
  return `${value.slice(0, MEDIA_FIELD_MAX_LEN)}…`
}

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
