/**
 * 时区相关工具函数
 * 默认使用 Asia/Shanghai (GMT+8)
 */

export const DEFAULT_TIMEZONE = 'Asia/Shanghai'
const FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>()

/** 常用时区列表 */
export const TIMEZONE_OPTIONS = [
  { value: 'Asia/Shanghai', label: '中国标准时间 (GMT+8)' },
  { value: 'Asia/Tokyo', label: '日本标准时间 (GMT+9)' },
  { value: 'Asia/Seoul', label: '韩国标准时间 (GMT+9)' },
  { value: 'Asia/Singapore', label: '新加坡时间 (GMT+8)' },
  { value: 'Asia/Hong_Kong', label: '香港时间 (GMT+8)' },
  { value: 'Asia/Taipei', label: '台北时间 (GMT+8)' },
  { value: 'Europe/London', label: '伦敦时间 (GMT+0/+1)' },
  { value: 'Europe/Paris', label: '巴黎时间 (GMT+1/+2)' },
  { value: 'Europe/Berlin', label: '柏林时间 (GMT+1/+2)' },
  { value: 'America/New_York', label: '纽约时间 (GMT-5/-4)' },
  { value: 'America/Los_Angeles', label: '洛杉矶时间 (GMT-8/-7)' },
  { value: 'America/Chicago', label: '芝加哥时间 (GMT-6/-5)' },
  { value: 'Australia/Sydney', label: '悉尼时间 (GMT+10/+11)' },
  { value: 'Pacific/Auckland', label: '奥克兰时间 (GMT+12/+13)' },
  { value: 'UTC', label: '协调世界时 (UTC)' },
] as const

/**
 * 验证时区字符串是否有效
 */
export function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/**
 * 规范化时区字符串，无效则返回默认值
 */
export function normalizeTimezone(tz: unknown): string {
  if (typeof tz !== 'string' || !tz.trim()) {
    return DEFAULT_TIMEZONE
  }
  const trimmed = tz.trim()
  return isValidTimezone(trimmed) ? trimmed : DEFAULT_TIMEZONE
}

export function resolveEffectiveTimezone(
  timezone: unknown,
  forceDisplayTimezone: unknown,
): string | null {
  return forceDisplayTimezone === true ? normalizeTimezone(timezone) : null
}

/**
 * Parse timestamps for display. SQLite `datetime('now')` and TEXT columns store UTC wall time
 * without a `Z` suffix; `new Date("YYYY-MM-DD HH:mm:ss")` is interpreted as *local* time in JS,
 * which breaks `displayTimezone` formatting. Naive `YYYY-MM-DD[ T]HH:mm:ss` is treated as UTC.
 */
export function parseInstantForDisplay(input: Date | string | number): Date {
  if (input instanceof Date) return input
  if (typeof input === 'number') return new Date(input)
  const s = input.trim()
  if (!s) return new Date(NaN)
  if (/[zZ]$/.test(s) || /[+-]\d{2}:\d{2}$/.test(s)) return new Date(s)
  const m = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)$/)
  if (m) return new Date(`${m[1]}T${m[2]}Z`)
  return new Date(s)
}

/**
 * Stable ISO-8601 instant (UTC, `Z`) for `<time dateTime>` and APIs. Use at serialization boundaries.
 */
export function coerceDbTimestampToIsoUtc(
  value: Date | string | number | null | undefined,
): string {
  if (value == null) return new Date(0).toISOString()
  const d = parseInstantForDisplay(value)
  return Number.isNaN(d.getTime()) ? new Date(0).toISOString() : d.toISOString()
}

type DateParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

function getCachedFormatter(timezone: string): Intl.DateTimeFormat {
  const key = timezone || '__local__'
  const existing = FORMATTER_CACHE.get(key)
  if (existing) return existing
  const formatter = new Intl.DateTimeFormat('en-CA', {
    ...(timezone ? { timeZone: timezone } : {}),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  })
  FORMATTER_CACHE.set(key, formatter)
  return formatter
}

function parseNumberPart(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPart['type'],
): number {
  const raw = parts.find((part) => part.type === type)?.value
  const value = Number(raw)
  return Number.isFinite(value) ? value : 0
}

export function getDateParts(
  date: Date | string | number,
  timezone?: string | null,
): DateParts {
  const d = parseInstantForDisplay(date)
  if (Number.isNaN(d.getTime())) {
    return {
      year: 0,
      month: 0,
      day: 0,
      hour: 0,
      minute: 0,
      second: 0,
    }
  }

  const tz = typeof timezone === 'string' && timezone.trim() ? normalizeTimezone(timezone) : null
  if (!tz) {
    return {
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: d.getDate(),
      hour: d.getHours(),
      minute: d.getMinutes(),
      second: d.getSeconds(),
    }
  }

  const parts = getCachedFormatter(tz).formatToParts(d)
  return {
    year: parseNumberPart(parts, 'year'),
    month: parseNumberPart(parts, 'month'),
    day: parseNumberPart(parts, 'day'),
    hour: parseNumberPart(parts, 'hour'),
    minute: parseNumberPart(parts, 'minute'),
    second: parseNumberPart(parts, 'second'),
  }
}

function pad2(value: number): string {
  return String(Math.max(0, Math.trunc(value))).padStart(2, '0')
}

export function formatDisplayPattern(
  date: Date | string | number,
  pattern: string,
  timezone?: string | null,
): string {
  const d = parseInstantForDisplay(date)
  if (Number.isNaN(d.getTime())) return ''
  const parts = getDateParts(d, timezone)
  const replacements: Record<string, string> = {
    yyyy: String(parts.year),
    MM: pad2(parts.month),
    dd: pad2(parts.day),
    HH: pad2(parts.hour),
    mm: pad2(parts.minute),
    ss: pad2(parts.second),
    M: String(parts.month),
    d: String(parts.day),
  }
  return pattern.replace(/yyyy|MM|dd|HH|mm|ss|M|d/g, (token) => replacements[token] ?? token)
}

export function toWallClockDate(
  date: Date | string | number,
  timezone?: string | null,
): Date {
  const d = parseInstantForDisplay(date)
  if (Number.isNaN(d.getTime())) return d
  const tz = typeof timezone === 'string' && timezone.trim() ? normalizeTimezone(timezone) : null
  if (!tz) return d
  const parts = getDateParts(d, tz)
  return new Date(
    parts.year,
    Math.max(0, parts.month - 1),
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    0,
  )
}

/**
 * 在指定时区格式化日期
 */
export function formatInTimezone(
  date: Date | string | number,
  timezone: string,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = parseInstantForDisplay(date)
  const tz = isValidTimezone(timezone) ? timezone : DEFAULT_TIMEZONE
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }
  
  return new Intl.DateTimeFormat('zh-CN', { ...defaultOptions, ...options }).format(d)
}

/**
 * 获取简短的日期时间格式 (yyyy-MM-dd HH:mm)
 */
export function formatDateTimeShort(date: Date | string | number, timezone: string): string {
  return formatDisplayPattern(date, 'yyyy-MM-dd HH:mm', timezone)
}
