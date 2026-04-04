'use client'

export const adminQueryKeys = {
  settings: {
    detail: () => ['admin', 'settings'] as const,
  },
  users: {
    list: () => ['admin', 'users'] as const,
  },
  devices: {
    page: (input: { page: number; q: string; status: string }) =>
      ['admin', 'devices', input] as const,
    list: (input?: { limit?: number; status?: string }) =>
      ['admin', 'devices', input ?? {}] as const,
  },
  tokens: {
    page: (input: { page: number }) => ['admin', 'tokens', input] as const,
    options: () => ['admin', 'tokens', 'options'] as const,
  },
  inspiration: {
    entries: (input: { page: number; q: string }) =>
      ['admin', 'inspiration', 'entries', input] as const,
    devices: (input?: { limit?: number }) =>
      ['admin', 'inspiration', 'devices', input ?? {}] as const,
    orphanAssets: () => ['admin', 'inspiration', 'orphan-assets'] as const,
  },
  activity: {
    feed: () => ['activity', 'feed'] as const,
    publicFeed: () => ['activity', 'public-feed'] as const,
    recentUsage: () => ['activity', 'recent-usage'] as const,
    exportApps: () => ['admin', 'activity-history', 'apps-export'] as const,
    historyApps: (input?: { limit?: number }) =>
      ['admin', 'activity-history', 'apps', input ?? {}] as const,
    historyPlaySources: (input?: { limit?: number }) =>
      ['admin', 'activity-history', 'play-sources', input ?? {}] as const,
  },
  skills: {
    settings: () => ['admin', 'skills', 'settings'] as const,
  },
}
