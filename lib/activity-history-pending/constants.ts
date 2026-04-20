import { randomUUID } from 'node:crypto'

export const PENDING_HASH_KEY = 'waken:activityHistory:pending:v1'
export const FLUSH_LOCK_KEY = 'waken:activityHistory:flushLock:v1'
export const ACTIVITY_HISTORY_INSTANCE_ID = randomUUID()

export const MEMORY_FLUSH_INTERVAL_MS = 30_000
export const MEMORY_FLUSH_MAX_ITEMS = 400
export const REMOTE_FLUSH_LOCK_TTL_SECONDS = 30
export const PENDING_ENTRY_TTL_MS = 3 * 24 * 60 * 60 * 1000
