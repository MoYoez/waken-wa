// 重新导出 Prisma 生成的类型
export type { ActivityLog, ApiToken, AdminUser } from '@prisma/client'

export interface ActivityInput {
  device: string
  process_name: string
  process_title?: string
  started_at?: string
  ended_at?: string
  metadata?: Record<string, unknown>
}

export interface PaginatedResponse<T> {
  success: boolean
  data: T[]
  pagination: {
    limit: number
    offset: number
    total: number
  }
}

export interface StatsData {
  totalActivities: number
  todayActivities: number
  totalDevices: number
  activeTokens: number
  recentDevices: Array<{ device: string; last_used: Date; count: string }>
  topProcesses: Array<{ process_name: string; count: string }>
}
