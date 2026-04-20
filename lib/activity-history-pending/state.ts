import type { PendingHistoryEntry } from '@/lib/activity-history-pending/types'

export const memoryPending = new Map<string, PendingHistoryEntry>()
