'use client'

import { createContext, type ReactNode,useContext } from 'react'

import { useActivityFeed } from '@/hooks/use-activity-feed'
import type { ActivityUpdateMode } from '@/lib/activity-update-mode'
import type { ActivityFeedData } from '@/types/activity'

type ActivityFeedContextValue = ReturnType<typeof useActivityFeed>

const ActivityFeedContext = createContext<ActivityFeedContextValue | null>(null)

/**
 * Single subscription for the home column (profile + current status) so polling does not duplicate /api/activity?public=1.
 */
export function ActivityFeedProvider({
  initialFeed,
  mode,
  children,
}: {
  initialFeed?: ActivityFeedData | null
  mode: ActivityUpdateMode
  children: ReactNode
}) {
  const value = useActivityFeed({ initialFeed, mode })
  return <ActivityFeedContext.Provider value={value}>{children}</ActivityFeedContext.Provider>
}

export function useSharedActivityFeed(): ActivityFeedContextValue {
  const ctx = useContext(ActivityFeedContext)
  if (!ctx) {
    throw new Error('useSharedActivityFeed must be used within ActivityFeedProvider')
  }
  return ctx
}
