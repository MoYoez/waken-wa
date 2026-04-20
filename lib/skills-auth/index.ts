import 'server-only'

export {
  clearSkillsApiKey,
  getSkillsSecretEnvStatus,
  hasLegacyMcpApiKeyConfigured,
  hasSkillsApiKeyConfigured,
  rotateLegacyMcpApiKey,
  rotateSkillsApiKey,
  verifyLegacyMcpApiKey,
} from '@/lib/skills-auth/secrets'
export {
  approveSkillsOauthAuthorizeCode,
  createSkillsOauthAuthorizeCode,
  exchangeSkillsOauthCodeForToken,
  getSkillsOauthAuthorizeRequest,
  hasSkillsOauthTokenConfigured,
  listSkillsOauthAuthorizeSummary,
  revokeAllSkillsOauthTokens,
  revokeSkillsOauthTokensByAiClientId,
  rotateSkillsOauthToken,
} from '@/lib/skills-auth/oauth'
export {
  hasLlmSkillsHeaders,
  normalizeAiClientId,
  normalizeSkillsOauthTokenTtlMinutes,
} from '@/lib/skills-auth/shared'
export {
  isLegacyMcpEnabled,
  requireAdminOrSkills,
  verifySkillsRequest,
} from '@/lib/skills-auth/verify'
export type {
  GuardFail,
  GuardOk,
  SkillsAuthMode,
  SkillsOauthAuthorizeRequest,
  SkillsOauthAuthorizeSummaryRow,
  SkillsOauthExchangeResult,
  SkillsScope,
  SkillsVerifyFail,
  SkillsVerifyOk,
} from '@/lib/skills-auth/types'
