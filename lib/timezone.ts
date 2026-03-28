/**
 * 时区相关工具函数
 * 默认使用 Asia/Shanghai (GMT+8)
 */

export const DEFAULT_TIMEZONE = 'Asia/Shanghai'

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

/**
 * 在指定时区格式化日期
 */
export function formatInTimezone(
  date: Date | string | number,
  timezone: string,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date
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
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date
  const tz = isValidTimezone(timezone) ? timezone : DEFAULT_TIMEZONE
  
  const formatted = new Intl.DateTimeFormat('sv-SE', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
  
  // sv-SE locale gives us "yyyy-MM-dd HH:mm" format
  return formatted.replace(',', '')
}
