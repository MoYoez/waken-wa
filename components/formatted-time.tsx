'use client'

import { useSiteTimezone } from '@/components/site-timezone-provider'
import { useIsClient } from '@/hooks/use-is-client'
import {
  coerceDbTimestampToIsoUtc,
  DEFAULT_TIMEZONE,
  formatDisplayPattern,
  normalizeTimezone,
  resolveEffectiveTimezone,
} from '@/lib/timezone'

interface FormattedTimeProps {
  /** ISO 日期字符串或 Date 对象 */
  date: string | Date | number | null | undefined
  /** 时区，默认从站点配置获取，未配置则使用 Asia/Shanghai */
  timezone?: string
  /** 是否强制使用传入时区；未传时读取站点配置 */
  forceTimezone?: boolean
  /** 自定义 className */
  className?: string
  /** 自定义格式，默认 yyyy-MM-dd HH:mm */
  pattern?: string
  /** 未挂载且使用访客本地时区时的占位 */
  fallback?: string
}

/**
 * 客户端时间格式化组件
 * 使用配置的时区显示时间，避免服务端/客户端水合错误
 */
export function FormattedTime({
  date,
  timezone,
  forceTimezone,
  className,
  pattern = 'yyyy-MM-dd HH:mm',
  fallback = '--',
}: FormattedTimeProps) {
  const mounted = useIsClient()
  const siteTimezone = useSiteTimezone()
  const tz =
    (typeof timezone === 'string' && timezone.trim() && normalizeTimezone(timezone)) ||
    siteTimezone.displayTimezone ||
    DEFAULT_TIMEZONE
  const forceDisplayTimezone =
    forceTimezone === undefined ? siteTimezone.forceDisplayTimezone === true : forceTimezone === true
  const effectiveTimezone = resolveEffectiveTimezone(tz, forceDisplayTimezone)
  const isoInstant = coerceDbTimestampToIsoUtc(date ?? null)
  const timeProps = date ? { dateTime: isoInstant } : {}

  if (!date) {
    return (
      <time className={className} suppressHydrationWarning {...timeProps}>
        {fallback}
      </time>
    )
  }

  if (!mounted && !forceDisplayTimezone) {
    return (
      <time className={className} suppressHydrationWarning {...timeProps}>
        {fallback}
      </time>
    )
  }

  const formatted = formatDisplayPattern(date, pattern, effectiveTimezone)

  return (
    <time className={className} suppressHydrationWarning {...timeProps}>
      {formatted || fallback}
    </time>
  )
}
