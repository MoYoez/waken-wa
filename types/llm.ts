export type SkillsMode = 'oauth' | 'apikey'

export interface LlmEndpoints {
  llmBase: string
  direct: string
  markdown: string
  settings: string
  appsExport: string
  oauthExchange: string
  legacyMcp: string
  legacyMcpApiKeyVerify: string
}
