import { useQuery } from '@tanstack/react-query'
import { useDeferredValue } from 'react'

import {
  fetchActivityHistoryApps,
  fetchActivityHistoryPlaySources,
} from '@/components/admin/admin-query-fetchers'
import { adminQueryKeys } from '@/components/admin/admin-query-keys'

export function useHistoryAppSuggestions(query: string, enabled: boolean) {
  const deferredQuery = useDeferredValue(query)
  return useQuery({
    queryKey: adminQueryKeys.activity.historyApps({ q: deferredQuery, limit: 20 }),
    queryFn: () => fetchActivityHistoryApps({ q: deferredQuery, limit: 20 }),
    enabled,
  })
}

export function useHistoryPlaySourceSuggestions(query: string, enabled: boolean) {
  const deferredQuery = useDeferredValue(query)
  return useQuery({
    queryKey: adminQueryKeys.activity.historyPlaySources({ q: deferredQuery, limit: 20 }),
    queryFn: () => fetchActivityHistoryPlaySources({ q: deferredQuery, limit: 20 }),
    enabled,
  })
}
