/** Same bounds as admin quick-add persist (seconds). */
export const USER_ACTIVITY_PERSIST_MIN_SEC = 30
export const USER_ACTIVITY_PERSIST_MAX_SEC = 24 * 60 * 60

/**
 * Convert client persist_minutes to absolute expiry, or null if invalid / omitted.
 */
export function persistMinutesToExpiresAt(persistMinutesRaw: unknown): Date | null {
  if (persistMinutesRaw === undefined || persistMinutesRaw === null) return null
  const mins = Number(persistMinutesRaw)
  if (!Number.isFinite(mins) || mins <= 0) return null
  const sec = Math.round(mins * 60)
  const clamped = Math.min(Math.max(sec, USER_ACTIVITY_PERSIST_MIN_SEC), USER_ACTIVITY_PERSIST_MAX_SEC)
  return new Date(Date.now() + clamped * 1000)
}
