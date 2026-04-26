'use client'

export const adminQueryKeys = {
  settings: {
    detail: () => ['admin', 'settings'] as const,
    migration: () => ['admin', 'settings', 'migration'] as const,
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
    historyApps: (input?: { q?: string; limit?: number; offset?: number }) =>
      ['admin', 'activity-history', 'apps', input ?? {}] as const,
    historyPlaySources: (input?: { q?: string; limit?: number; offset?: number }) =>
      ['admin', 'activity-history', 'play-sources', input ?? {}] as const,
  },
  ruleTools: {
    summary: () => ['admin', 'rule-tools', 'summary'] as const,
    config: () => ['admin', 'rule-tools', 'config'] as const,
    rules: (input: { q: string; page: number; pageSize: number }) =>
      ['admin', 'rule-tools', 'rules', input] as const,
    rulesPreview: () => ['admin', 'rule-tools', 'rules-preview'] as const,
    list: (input: { listKey: string; q: string; page: number; pageSize: number }) =>
      ['admin', 'rule-tools', 'list', input] as const,
    export: () => ['admin', 'rule-tools', 'export'] as const,
  },
  skills: {
    settings: () => ['admin', 'skills', 'settings'] as const,
  },
}
