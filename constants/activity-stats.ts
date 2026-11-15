export const ACTIVITY_STATS_DEFAULT_RANGE_DAYS = 30
export const ACTIVITY_STATS_MIN_RANGE_DAYS = 7
export const ACTIVITY_STATS_MAX_RANGE_DAYS = 180
export const ACTIVITY_STATS_RANGE_OPTIONS = [7, 30, 90, 180] as const
export const ACTIVITY_STATS_TOP_LIMIT = 10
export const ACTIVITY_STATS_RECENT_LIMIT = 8
export const ACTIVITY_STATS_DEVICE_LIMIT = 12
/** A device counts as "active" when seen within this window. */
export const ACTIVITY_STATS_DEVICE_ACTIVE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

export function NormalizeActivityStatsRangeDays(raw: unknown): number {
  const value = Number(raw)
  if (!Number.isFinite(value)) return ACTIVITY_STATS_DEFAULT_RANGE_DAYS
  const truncated = Math.trunc(value)
  if (truncated < ACTIVITY_STATS_MIN_RANGE_DAYS) return ACTIVITY_STATS_MIN_RANGE_DAYS
  if (truncated > ACTIVITY_STATS_MAX_RANGE_DAYS) return ACTIVITY_STATS_MAX_RANGE_DAYS
  return truncated
}
