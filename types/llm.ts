export type SkillsMode = 'oauth' | 'apikey'

export interface LlmEndpoints {
  llmBase: string
  direct: string
  markdown: string
  settings: string
  appsExport: string
  legacyMcp: string
  legacyMcpApiKeyVerify: string
}
