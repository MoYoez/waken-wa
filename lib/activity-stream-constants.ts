export const ACTIVITY_STREAM_MAX_CONCURRENT_CONNECTIONS = 50
/** Max time without a successful push; resets on each push (sliding lease). */
export const ACTIVITY_STREAM_MAX_IDLE_MS = 10 * 60 * 1000
/** Poll interval for shared activity snapshot refresh. */
export const ACTIVITY_STREAM_POLL_INTERVAL_MS = 15 * 1000
/** After repeated fetch failures, keep stream alive but emit error events. */
export const ACTIVITY_STREAM_MAX_CONSECUTIVE_PUSH_FAILURES = 3
