// 重新导出 Prisma 生成的类型
export type { ActivityLog, ApiToken, AdminUser } from '@prisma/client'

export interface ActivityInput {
  generatedHashKey: string
  device: string
  device_type?: 'desktop' | 'tablet' | 'mobile'
  process_name: string
  process_title?: string
  battery_level?: number
  push_mode?: 'realtime' | 'active'
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
