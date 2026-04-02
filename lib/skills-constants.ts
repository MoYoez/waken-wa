export const SKILLS_SECRET_KEYS = {
  skillsApiKey: 'skills_apikey_bcrypt',
  legacyMcpApiKey: 'mcp_theme_tools_key_bcrypt',
  skillsOauthAuthorizeCodePrefix: 'skills_oauth_authorize_code:',
} as const

export const SKILLS_SECRET_ENV_KEYS = {
  skillsApiKey: 'SKILLS_API_KEY',
  legacyMcpApiKey: 'LEGACY_MCP_API_KEY',
} as const

export const SKILLS_HEADER_PREFIX = 'llm-skills-'

export const SKILLS_AUTHORIZE_CODE_DEFAULT_TTL_MS = 15 * 60_000
export const SKILLS_OAUTH_TOKEN_DEFAULT_TTL_MS = 60 * 60_000
export const SKILLS_MIN_TOKEN_TTL_MS = 60_000
