'use client'

import {
  createContext,
  type ReactNode,
  useContext,
} from 'react'

import { useIsClient } from '@/hooks/use-is-client'
import {
  DEFAULT_TIMEZONE,
  formatDisplayPattern,
  normalizeTimezone,
  resolveEffectiveTimezone,
  toWallClockDate,
} from '@/lib/timezone'

type SiteTimezoneContextValue = {
  displayTimezone: string
  forceDisplayTimezone: boolean
}

const SiteTimezoneContext = createContext<SiteTimezoneContextValue>({
  displayTimezone: DEFAULT_TIMEZONE,
  forceDisplayTimezone: false,
})

export function SiteTimezoneProvider({
  children,
  displayTimezone,
  forceDisplayTimezone,
}: {
  children: ReactNode
  displayTimezone: string
  forceDisplayTimezone: boolean
}) {
  return (
    <SiteTimezoneContext.Provider
      value={{
        displayTimezone: normalizeTimezone(displayTimezone),
        forceDisplayTimezone: forceDisplayTimezone === true,
      }}
    >
      {children}
    </SiteTimezoneContext.Provider>
  )
}

export function useSiteTimezone() {
  return useContext(SiteTimezoneContext)
}

export function useSiteTimeFormat() {
  const mounted = useIsClient()
  const { displayTimezone, forceDisplayTimezone } = useSiteTimezone()
  const effectiveTimezone = resolveEffectiveTimezone(displayTimezone, forceDisplayTimezone)
  const canFormatAbsolute = forceDisplayTimezone || mounted

  const formatPattern = (
    value: Date | string | number | null | undefined,
    pattern: string,
    fallback = '—',
  ): string => {
    if (value == null) return fallback
    if (!canFormatAbsolute) return fallback
    return formatDisplayPattern(value, pattern, effectiveTimezone) || fallback
  }

  const toDisplayWallClockDate = (value: Date | string | number) =>
    toWallClockDate(value, effectiveTimezone)

  return {
    mounted,
    displayTimezone,
    forceDisplayTimezone,
    effectiveTimezone,
    canFormatAbsolute,
    formatPattern,
    toDisplayWallClockDate,
  }
}
