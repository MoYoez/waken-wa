/**
 * Activity update mode configuration
 * 
 * Modes:
 * - "sse": Server-Sent Events (default) - moderate resource usage, good real-time
 * - "realtime": Supabase Realtime - best real-time but higher resource usage on Serverless
 * - "polling": HTTP polling - lowest resource usage but less real-time
 */

export type ActivityUpdateMode = 'sse' | 'realtime' | 'polling'

export const ACTIVITY_UPDATE_MODE_OPTIONS: {
  value: ActivityUpdateMode
  label: string
  description: string
  warning?: string
}[] = [
  {
    value: 'sse',
    label: 'SSE 推送',
    description: '服务器推送事件，平衡实时性和资源消耗',
  },
  {
    value: 'realtime',
    label: 'Realtime 实时订阅',
    description: '使用数据库实时订阅功能，获得最佳实时性。仅支持 Supabase 部署，本地 PostgreSQL 和 SQLite 不可用。',
    warning: '仅 Supabase 环境可用。在 Serverless 环境下可能产生较高的资源消耗和费用。每个连接会持续占用数据库连接池资源。',
  },
  {
    value: 'polling',
    label: 'HTTP 轮询',
    description: '定时请求更新，最低资源消耗但实时性较差',
  },
]

export const DEFAULT_ACTIVITY_UPDATE_MODE: ActivityUpdateMode = 'sse'

export function normalizeActivityUpdateMode(value: unknown): ActivityUpdateMode {
  if (typeof value === 'string') {
    const lower = value.toLowerCase() as ActivityUpdateMode
    if (lower === 'sse' || lower === 'realtime' || lower === 'polling') {
      return lower
    }
  }
  return DEFAULT_ACTIVITY_UPDATE_MODE
}
