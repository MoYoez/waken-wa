// 重新导出 Prisma 生成的类型
export type { ActivityLog, ApiToken, AdminUser } from '@prisma/client'

export interface ActivityInput {
  device: string
  process_name: string
  process_title?: string
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
