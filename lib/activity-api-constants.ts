/** Max keys allowed on activity POST `metadata` object (validation). */
export const ACTIVITY_METADATA_MAX_KEYS = 50

/** Max `JSON.stringify(metadata)` length for activity POST validation. */
export const ACTIVITY_METADATA_MAX_JSON_LENGTH = 10240

/** Max data URL length accepted for one activity media cover upload. */
export const ACTIVITY_MEDIA_COVER_DATA_URL_MAX_LENGTH = 2 * 1024 * 1024

/** Default limit for activity feed reads (REST, SSE, status snapshots). */
export const ACTIVITY_FEED_DEFAULT_LIMIT = 50

/** Hard cap for how many recent rows `getActivityFeedData` considers (query clamp). */
export const ACTIVITY_FEED_QUERY_MAX_LIMIT = 100

/** Max distinct processes in `recentTopApps` sidebar list. */
export const ACTIVITY_FEED_RECENT_TOP_APPS_MAX = 3

/**
 * Default Redis TTL (seconds) for aggregated activity feed cache (`waken:activity:feed:v1`).
 * Includes DB-backed `userActivities` rows merged into the feed payload.
 */
export const REDIS_ACTIVITY_FEED_CACHE_TTL_DEFAULT_SECONDS = 3600

/** Upper bound for site-config / env activity-feed Redis TTL (seconds). */
export const REDIS_ACTIVITY_FEED_CACHE_TTL_MAX_SECONDS = 86400

/** Battery percent clamp for activity POST payloads (inclusive). */
export const DEVICE_BATTERY_PERCENT_MIN = 0
export const DEVICE_BATTERY_PERCENT_MAX = 100
