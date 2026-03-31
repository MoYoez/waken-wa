'use client'

import { useIsClient } from '@/hooks/use-is-client'
import { coerceDbTimestampToIsoUtc, DEFAULT_TIMEZONE, formatDateTimeShort } from '@/lib/timezone'

interface FormattedTimeProps {
  /** ISO 日期字符串或 Date 对象 */
  date: string | Date
  /** 时区，默认从站点配置获取，未配置则使用 Asia/Shanghai */
  timezone?: string
  /** 自定义 className */
  className?: string
}

/**
 * 客户端时间格式化组件
 * 使用配置的时区显示时间，避免服务端/客户端水合错误
 */
export function FormattedTime({ date, timezone, className }: FormattedTimeProps) {
  const mounted = useIsClient()

  const tz = (typeof timezone === 'string' && timezone.trim()) || DEFAULT_TIMEZONE
  const isoInstant = coerceDbTimestampToIsoUtc(typeof date === 'string' ? date : date)

  if (!mounted) {
    return <time className={className} dateTime={isoInstant} suppressHydrationWarning>--</time>
  }

  const formatted = formatDateTimeShort(date, tz)

  return <time className={className} dateTime={isoInstant} suppressHydrationWarning>{formatted}</time>
}
