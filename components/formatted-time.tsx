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
  /** ISO date string, Date object, or timestamp. */
  date: string | Date | number | null | undefined
  /** Timezone. Defaults to the site setting, then Asia/Shanghai. */
  timezone?: string
  /** Whether to force the provided timezone instead of the viewer-local one. */
  forceTimezone?: boolean
  /** Optional className. */
  className?: string
  /** Optional date-fns pattern. Defaults to yyyy-MM-dd HH:mm. */
  pattern?: string
  /** Placeholder shown before mount when viewer-local timezone formatting is deferred. */
  fallback?: string
}

/**
 * Client-side time formatter.
 * Uses the configured timezone to avoid server/client hydration mismatches.
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
