import type {
  AppHistoryBuckets,
  PendingHistoryEntry,
  Platform,
  PlatformBucket,
} from '@/lib/activity-history-pending/types'
import { sqlDate, sqlTimestamp } from '@/lib/sql-timestamp'

export function normalizeProcessName(raw: string): string {
  return raw.trim().toLowerCase()
}

export function normalizeTitle(raw: unknown): string {
  return String(raw ?? '').trim()
}

export function platformFromDeviceType(deviceTypeRaw: unknown): Platform {
  const type = String(deviceTypeRaw ?? '').trim().toLowerCase()
  if (type === 'mobile' || type === 'tablet') return 'mobile'
  return 'pc'
}

export function normalizePlaySource(raw: unknown): string {
  return String(raw ?? '').trim().toLowerCase()
}

export function bumpRecentTitles(existing: string[], nextTitle: string): string[] {
  const title = nextTitle.trim()
  if (!title) return existing.slice(0, 3)
  const out: string[] = [title]
  for (const current of existing) {
    if (!current) continue
    if (current.toLowerCase() === title.toLowerCase()) continue
    out.push(current)
    if (out.length >= 3) break
  }
  return out
}

export function mergeBuckets(
  prev: AppHistoryBuckets | null | undefined,
  platform: Platform,
  titles: string[],
  seenAtIso: string,
): AppHistoryBuckets {
  const safePrev = prev && typeof prev === 'object' && !Array.isArray(prev) ? prev : {}
  const currentBucket =
    (platform === 'pc' ? safePrev.pc : safePrev.mobile) ?? { titles: [], lastSeenAt: null }
  const nextBucket: PlatformBucket = {
    titles: titles.length > 0 ? titles.slice(0, 3) : currentBucket.titles.slice(0, 3),
    lastSeenAt: seenAtIso || currentBucket.lastSeenAt || null,
  }
  return {
    ...(safePrev as AppHistoryBuckets),
    [platform]: nextBucket,
  }
}

export function parseBuckets(raw: unknown): AppHistoryBuckets | null {
  if (!raw) return null
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as AppHistoryBuckets
      }
      return null
    } catch {
      return null
    }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as AppHistoryBuckets
  return null
}

export function asSqlDate(value: unknown): Date | string {
  if (value instanceof Date) return sqlDate(value)
  const time = Date.parse(String(value ?? ''))
  if (Number.isFinite(time)) return sqlDate(new Date(time))
  return sqlTimestamp()
}

export function pendingField(entry: PendingHistoryEntry): string {
  if (entry.kind === 'app') {
    return `app:${entry.platform}:${entry.processName}`
  }
  return `play:${entry.playSource}`
}

function parsePendingField(
  field: string,
): { kind: 'app'; platform: Platform; key: string } | { kind: 'playSource'; key: string } | null {
  const trimmed = field.trim()
  if (!trimmed) return null

  if (trimmed.startsWith('app:')) {
    const parts = trimmed.split(':')
    if (parts.length < 3) return null
    const platform = parts[1] === 'mobile' ? 'mobile' : parts[1] === 'pc' ? 'pc' : null
    if (!platform) return null
    const key = parts.slice(2).join(':').trim()
    if (!key) return null
    return { kind: 'app', platform, key }
  }

  if (trimmed.startsWith('play:')) {
    const key = trimmed.slice('play:'.length).trim()
    if (!key) return null
    return { kind: 'playSource', key }
  }

  return null
}

export function parsePendingEntry(
  raw: string,
  field: string,
  nowMs = Date.now(),
): { entry: PendingHistoryEntry | null; expired: boolean } {
  const parsedField = parsePendingField(field)
  if (!parsedField) return { entry: null, expired: false }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { entry: null, expired: false }
    }

    const expiresAtMs = Date.parse(String(parsed.expiresAt ?? ''))
    const expired = Number.isFinite(expiresAtMs) && expiresAtMs <= nowMs
    const base = {
      seenAt: String(parsed.seenAt ?? ''),
      sourceInstanceId: String(parsed.sourceInstanceId ?? ''),
      expiresAt: String(parsed.expiresAt ?? ''),
    }

    if (parsedField.kind === 'app') {
      const processName = normalizeProcessName(String(parsed.processName ?? parsedField.key))
      if (!processName) return { entry: null, expired }
      const titles = Array.isArray(parsed.titles)
        ? parsed.titles.map((title) => normalizeTitle(title)).filter(Boolean).slice(0, 3)
        : []
      return {
        entry: expired
          ? null
          : {
              ...base,
              kind: 'app',
              processName,
              platform: parsedField.platform,
              titles,
            },
        expired,
      }
    }

    const playSource = normalizePlaySource(parsed.playSource ?? parsedField.key)
    return {
      entry: expired || !playSource
        ? null
        : {
            ...base,
            kind: 'playSource',
            playSource,
          },
      expired,
    }
  } catch {
    return { entry: null, expired: false }
  }
}

export function isSamePendingEntry(
  left: PendingHistoryEntry | null | undefined,
  right: PendingHistoryEntry | null | undefined,
): boolean {
  if (!left || !right) return false
  if (left.kind !== right.kind) return false
  if (left.seenAt !== right.seenAt) return false
  if (left.sourceInstanceId !== right.sourceInstanceId) return false
  if (left.expiresAt !== right.expiresAt) return false

  if (left.kind === 'app' && right.kind === 'app') {
    if (left.processName !== right.processName) return false
    if (left.platform !== right.platform) return false
    if (left.titles.length !== right.titles.length) return false
    return left.titles.every((title, index) => title === right.titles[index])
  }

  return left.kind === 'playSource' && right.kind === 'playSource' && left.playSource === right.playSource
}
