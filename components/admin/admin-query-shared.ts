'use client'

type SuccessResponse<T> = {
  success?: boolean
  data?: T
  error?: string
}

type DevicesResponse = SuccessResponse<Array<Record<string, unknown>>>

type AdminSkillsData = {
  enabled?: boolean
  authMode?: unknown
  apiKeyConfigured?: boolean
  oauthConfigured?: boolean
  oauthTokenTtlMinutes?: unknown
  aiAuthorizations?: unknown
  generatedApiKey?: string | null
  legacyMcpConfigured?: boolean
  generatedLegacyMcpApiKey?: string | null
}

type PaginationResponse = {
  total?: number
}

async function readJson<T>(res: Response): Promise<T | null> {
  return res.json().catch(() => null)
}

export type {
  AdminSkillsData,
  DevicesResponse,
  PaginationResponse,
  SuccessResponse,
}
export { readJson }
