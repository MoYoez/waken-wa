'use client'

import { useEffect, useState } from 'react'
import { formatDateTimeShort, DEFAULT_TIMEZONE } from '@/lib/timezone'

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
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
  }, [])

  const tz = timezone || DEFAULT_TIMEZONE
  const isoDate = typeof date === 'string' ? date : date.toISOString()
  
  // 服务端渲染时显示占位符，避免水合错误
  // 两个分支都需要 suppressHydrationWarning 以确保 React 不会报错
  if (!mounted) {
    return <time className={className} dateTime={isoDate} suppressHydrationWarning>--</time>
  }

  const formatted = formatDateTimeShort(date, tz)

  return <time className={className} dateTime={isoDate} suppressHydrationWarning>{formatted}</time>
}
