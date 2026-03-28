import type { ActivityUpdateMode } from '@/types/activity-update-mode'

export type { ActivityUpdateMode } from '@/types/activity-update-mode'

/** SSE (default) vs HTTP polling. */
export const ACTIVITY_UPDATE_MODE_OPTIONS: {
  value: ActivityUpdateMode
  label: string
  description: string
  /** Optional caution shown below the option (e.g. hosting limits). */
  warning?: string
}[] = [
  {
    value: 'sse',
    label: 'SSE 推送',
    description: '服务器推送事件，平衡实时性和资源消耗',
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
    const lower = value.toLowerCase()
    if (lower === 'sse' || lower === 'polling') {
      return lower
    }
    // Legacy values (Supabase Realtime / WebSocket era)
    if (lower === 'realtime' || lower === 'websocket') {
      return 'sse'
    }
  }
  return DEFAULT_ACTIVITY_UPDATE_MODE
}
