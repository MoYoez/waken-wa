/** Max keys allowed on activity POST `metadata` object (validation). */
export const ACTIVITY_METADATA_MAX_KEYS = 50

/** Max `JSON.stringify(metadata)` length for activity POST validation. */
export const ACTIVITY_METADATA_MAX_JSON_LENGTH = 10240

/** Default limit for activity feed reads (REST, SSE, status snapshots). */
export const ACTIVITY_FEED_DEFAULT_LIMIT = 50

/** Hard cap for how many recent rows `getActivityFeedData` considers (query clamp). */
export const ACTIVITY_FEED_QUERY_MAX_LIMIT = 100

/** Max distinct processes in `recentTopApps` sidebar list. */
export const ACTIVITY_FEED_RECENT_TOP_APPS_MAX = 3

/** Battery percent clamp for activity POST payloads (inclusive). */
export const DEVICE_BATTERY_PERCENT_MIN = 0
export const DEVICE_BATTERY_PERCENT_MAX = 100
