export type MediaPlaybackState = 'playing' | 'paused' | 'stopped'

/** Display shape for `metadata.media` (now-playing title / optional singer / source / cover). */
export interface MediaDisplay {
  title: string
  singer: string | null
  album: string | null
  source: string | null
  coverUrl: string | null
  state: MediaPlaybackState | null
  positionMs: number | null
  durationMs: number | null
  startedAtMs: number | null
  endsAtMs: number | null
  reportedAtMs: number | null
}
