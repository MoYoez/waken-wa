/**
 * Defaults and inclusive bounds for `siteConfig` (API, activity feed, admin UI).
 */

export const SITE_CONFIG_HISTORY_WINDOW_DEFAULT_MINUTES = 120
export const SITE_CONFIG_HISTORY_WINDOW_MIN_MINUTES = 10
export const SITE_CONFIG_HISTORY_WINDOW_MAX_MINUTES = 24 * 60

export const SITE_CONFIG_PROCESS_STALE_DEFAULT_SECONDS = 500
export const SITE_CONFIG_PROCESS_STALE_MIN_SECONDS = 30
export const SITE_CONFIG_PROCESS_STALE_MAX_SECONDS = 24 * 60 * 60

export const SITE_CONFIG_SCHEDULE_SLOT_DEFAULT_MINUTES = 30

export const SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_MAX_LEN = 40
export const SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_DEFAULT = '正在摸鱼'

export function clampSiteConfigHistoryWindowMinutes(value: number): number {
  return Math.min(
    Math.max(Math.round(value), SITE_CONFIG_HISTORY_WINDOW_MIN_MINUTES),
    SITE_CONFIG_HISTORY_WINDOW_MAX_MINUTES,
  )
}

export function clampSiteConfigProcessStaleSeconds(value: number): number {
  return Math.min(
    Math.max(Math.round(value), SITE_CONFIG_PROCESS_STALE_MIN_SECONDS),
    SITE_CONFIG_PROCESS_STALE_MAX_SECONDS,
  )
}

/** Parse PATCH/setup body field; non-finite input falls back to default. */
export function parseHistoryWindowMinutes(raw: unknown): number {
  const parsed = Number(raw ?? SITE_CONFIG_HISTORY_WINDOW_DEFAULT_MINUTES)
  return Number.isFinite(parsed)
    ? clampSiteConfigHistoryWindowMinutes(parsed)
    : SITE_CONFIG_HISTORY_WINDOW_DEFAULT_MINUTES
}

export function parseProcessStaleSeconds(raw: unknown): number {
  const parsed = Number(raw ?? SITE_CONFIG_PROCESS_STALE_DEFAULT_SECONDS)
  return Number.isFinite(parsed)
    ? clampSiteConfigProcessStaleSeconds(parsed)
    : SITE_CONFIG_PROCESS_STALE_DEFAULT_SECONDS
}
