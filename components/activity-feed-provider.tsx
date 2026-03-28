'use client'

import { createContext, type ReactNode,useContext } from 'react'

import { useActivityFeed } from '@/hooks/use-activity-feed'
import type { ActivityUpdateMode } from '@/lib/activity-update-mode'

type ActivityFeedContextValue = ReturnType<typeof useActivityFeed>

const ActivityFeedContext = createContext<ActivityFeedContextValue | null>(null)

/**
 * Single subscription for the home column (profile + current status) so polling does not duplicate /api/activity?public=1.
 */
export function ActivityFeedProvider({
  mode,
  children,
}: {
  mode: ActivityUpdateMode
  children: ReactNode
}) {
  const value = useActivityFeed({ mode })
  return <ActivityFeedContext.Provider value={value}>{children}</ActivityFeedContext.Provider>
}

export function useSharedActivityFeed(): ActivityFeedContextValue {
  const ctx = useContext(ActivityFeedContext)
  if (!ctx) {
    throw new Error('useSharedActivityFeed must be used within ActivityFeedProvider')
  }
  return ctx
}
