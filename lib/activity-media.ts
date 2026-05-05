import type { MediaDisplay, MediaPlaybackState } from '@/types/activity-media'

export type { MediaDisplay, MediaPlaybackState } from '@/types/activity-media'

/** Parse now-playing data from POST /api/activity metadata. */
const MEDIA_FIELD_MAX_LEN = 200
const MAX_MEDIA_TIME_MS = 24 * 60 * 60 * 1000

function clampField(value: string): string {
  if (value.length <= MEDIA_FIELD_MAX_LEN) return value
  return `${value.slice(0, MEDIA_FIELD_MAX_LEN)}…`
}

function getOptionalText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const s = clampField(value.trim())
  return s || null
}

function getCoverUrl(media: Record<string, unknown>): string | null {
  const raw = typeof media.coverUrl === 'string' ? media.coverUrl : media.coverDataUrl
  if (typeof raw !== 'string') return null

  const url = raw.trim()
  if (!url || url.startsWith('data:')) return null
  return url
}

function getNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value)
    if (Number.isFinite(n)) return n
  }
  return null
}

function getDurationMs(media: Record<string, unknown>, msKeys: string[], secKeys: string[]): number | null {
  for (const key of msKeys) {
    const n = getNumber(media[key])
    if (n !== null && n >= 0 && n <= MAX_MEDIA_TIME_MS) return Math.round(n)
  }
  for (const key of secKeys) {
    const n = getNumber(media[key])
    if (n !== null && n >= 0 && n <= MAX_MEDIA_TIME_MS / 1000) return Math.round(n * 1000)
  }
  return null
}

function getTimestampMs(value: unknown): number | null {
  const n = getNumber(value)
  if (n !== null) {
    const ms = n > 10_000_000_000 ? n : n * 1000
    return ms > 0 ? Math.round(ms) : null
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function getTimestamps(media: Record<string, unknown>): {
  startedAtMs: number | null
  endsAtMs: number | null
} {
  const timestamps =
    media.timestamps && typeof media.timestamps === 'object' && !Array.isArray(media.timestamps)
      ? (media.timestamps as Record<string, unknown>)
      : null

  return {
    startedAtMs:
      getTimestampMs(timestamps?.start) ??
      getTimestampMs(media.startTimestamp) ??
      getTimestampMs(media.startedAt) ??
      getTimestampMs(media.startTime),
    endsAtMs:
      getTimestampMs(timestamps?.end) ??
      getTimestampMs(media.endTimestamp) ??
      getTimestampMs(media.endsAt) ??
      getTimestampMs(media.endTime),
  }
}

function getPlaybackState(media: Record<string, unknown>): MediaPlaybackState | null {
  const statusRaw = media.status ?? media.state ?? media.playbackState
  if (typeof statusRaw === 'string') {
    const s = statusRaw.trim().toLowerCase()
    if (['playing', 'play', 'running'].includes(s)) return 'playing'
    if (['paused', 'pause'].includes(s)) return 'paused'
    if (['stopped', 'stop', 'ended', 'idle'].includes(s)) return 'stopped'
  }

  const isPaused = media.isPaused ?? media.paused
  if (typeof isPaused === 'boolean') return isPaused ? 'paused' : 'playing'

  const isPlaying = media.isPlaying ?? media.playing
  if (typeof isPlaying === 'boolean') return isPlaying ? 'playing' : 'paused'

  return null
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
  const singer = getOptionalText(m.singer) ?? getOptionalText(m.artist)
  const album = getOptionalText(m.album)
  const sourceRaw = (metadata as Record<string, unknown>).play_source
  const source = getOptionalText(sourceRaw)
  const coverUrl = getCoverUrl(m)
  const { startedAtMs, endsAtMs } = getTimestamps(m)
  const inferredDurationMs =
    startedAtMs !== null && endsAtMs !== null && endsAtMs > startedAtMs
      ? endsAtMs - startedAtMs
      : null
  const durationMs =
    getDurationMs(m, ['durationMs', 'lengthMs', 'totalMs'], ['durationSec', 'lengthSec', 'totalSec']) ??
    inferredDurationMs
  const positionMs = getDurationMs(
    m,
    ['positionMs', 'elapsedMs', 'currentMs', 'progressMs'],
    ['positionSec', 'elapsedSec', 'currentSec', 'progressSec'],
  )
  const state = getPlaybackState(m) ?? (startedAtMs !== null || endsAtMs !== null ? 'playing' : null)

  return {
    title,
    singer,
    album,
    source,
    coverUrl,
    state,
    positionMs,
    durationMs,
    startedAtMs,
    endsAtMs,
    reportedAtMs:
      getTimestampMs(m.reportedAt) ??
      getTimestampMs(m.updatedAt) ??
      getTimestampMs(m.timestamp) ??
      null,
  }
}
