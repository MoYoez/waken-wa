export type Platform = 'pc' | 'mobile'

export type PlatformBucket = {
  titles: string[]
  lastSeenAt: string | null
}

export type AppHistoryBuckets = {
  pc?: PlatformBucket
  mobile?: PlatformBucket
}

type PendingEntryBase = {
  seenAt: string
  sourceInstanceId: string
  expiresAt: string
}

export type PendingAppHistory = PendingEntryBase & {
  kind: 'app'
  processName: string
  platform: Platform
  titles: string[]
}

export type PendingPlaySourceHistory = PendingEntryBase & {
  kind: 'playSource'
  playSource: string
}

export type PendingHistoryEntry = PendingAppHistory | PendingPlaySourceHistory

export type FlushResult = {
  flushed: number
}
