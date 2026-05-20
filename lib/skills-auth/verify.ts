import bcrypt from 'bcryptjs'
import { and, desc, eq, gt, isNull } from 'drizzle-orm'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { SKILLS_SECRET_KEYS } from '@/constants/skills'
import { db } from '@/lib/db'
import { skillsOauthTokens } from '@/lib/drizzle-schema'
import { getSiteConfigMemoryFirst } from '@/lib/site-config-cache'
import {
  getEnvSecretValue,
  readSecretValue,
} from '@/lib/skills-auth/secrets'
import {
  getConfiguredSkillsMode,
  getHeader,
  hasLlmSkillsHeaders,
  isSkillsHttpMode,
  normalizeAiClientId,
  parseMode,
  parseScope,
} from '@/lib/skills-auth/shared'
import { sqlTimestamp } from '@/lib/sql-timestamp'
import type {
  GuardFail,
  GuardOk,
  SkillsVerifyFail,
  SkillsVerifyOk,
} from '@/types/skills-auth'

async function verifyBcryptSecret(
  secretKey: string,
  plain: string,
): Promise<SkillsVerifyFail | { ok: true }> {
  if (!plain) return { ok: false, error: 'Unauthorized', status: 401 }
  const envSecret = getEnvSecretValue(secretKey)
  if (envSecret) {
    if (plain !== envSecret) return { ok: false, error: 'Unauthorized', status: 401 }
    return { ok: true }
  }
  const stored = await readSecretValue(secretKey)
  if (!stored) return { ok: false, error: 'Authorization credentials are not configured', status: 503 }
  const ok = await bcrypt.compare(plain, stored)
  if (!ok) return { ok: false, error: 'Unauthorized', status: 401 }
  return { ok: true }
}

export async function verifySkillsRequest(
  request: NextRequest,
): Promise<SkillsVerifyOk | SkillsVerifyFail> {
  const cfg = await getSiteConfigMemoryFirst()
  if (cfg?.skillsDebugEnabled !== true) {
    return { ok: false, error: 'Not found', status: 404 }
  }
  if (!isSkillsHttpMode(cfg?.aiToolMode)) {
    return { ok: false, error: 'MCP mode is active, so the Skills HTTP API is disabled', status: 403 }
  }

  const modeFromHeader = parseMode(getHeader(request, 'LLM-Skills-Mode'))
  const token = getHeader(request, 'LLM-Skills-Token')
  const requestId = getHeader(request, 'LLM-Skills-Request-Id') || null
  const scope = parseScope(getHeader(request, 'LLM-Skills-Scope'))
  const aiClientId = normalizeAiClientId(getHeader(request, 'LLM-Skills-AI'))

  const configuredMode = getConfiguredSkillsMode(cfg.skillsAuthMode)
  if (!configuredMode) {
    return { ok: false, error: 'Skills authentication mode is not configured. Select OAuth or APIKEY in settings first.', status: 503 }
  }
  if (modeFromHeader && modeFromHeader !== configuredMode) {
    return { ok: false, error: 'Authentication mode mismatch. Switch to the matching mode in settings.', status: 403 }
  }
  const mode = modeFromHeader ?? configuredMode

  if (mode === 'apikey') {
    const result = await verifyBcryptSecret(SKILLS_SECRET_KEYS.skillsApiKey, token)
    if (!result.ok) return result
    return { ok: true, mode, scope, requestId, aiClientId: aiClientId || null, isAdmin: false }
  }
  if (!aiClientId) {
    return { ok: false, error: 'OAuth mode requires an AI identifier in LLM-Skills-AI', status: 401 }
  }
  if (!token) {
    return { ok: false, error: 'Missing token', status: 401 }
  }
  const now = sqlTimestamp()
  const candidates = await db
    .select({ tokenHash: skillsOauthTokens.tokenHash, aiClientId: skillsOauthTokens.aiClientId })
    .from(skillsOauthTokens)
    .where(
      and(
        eq(skillsOauthTokens.aiClientId, aiClientId),
        gt(skillsOauthTokens.expiresAt, now as any),
        isNull(skillsOauthTokens.revokedAt),
      ),
    )
    .orderBy(desc(skillsOauthTokens.id))
  if (candidates.length === 0) {
    const activeTokens = await db
      .select({ tokenHash: skillsOauthTokens.tokenHash })
      .from(skillsOauthTokens)
      .where(and(gt(skillsOauthTokens.expiresAt, now as any), isNull(skillsOauthTokens.revokedAt)))
      .orderBy(desc(skillsOauthTokens.id))
      .limit(50)
    for (const row of activeTokens) {
      if (await bcrypt.compare(token, row.tokenHash)) {
        return { ok: false, error: 'AI identifier does not match the token. Use the LLM-Skills-AI value from issuance.', status: 401 }
      }
    }
    return { ok: false, error: 'OAuth authorization does not exist or has expired. Authorize again.', status: 401 }
  }
  for (const row of candidates) {
    if (await bcrypt.compare(token, row.tokenHash)) {
      return { ok: true, mode, scope, requestId, aiClientId: row.aiClientId, isAdmin: false }
    }
  }
  return { ok: false, error: 'Unauthorized', status: 401 }
}

export async function isLegacyMcpEnabled(): Promise<boolean> {
  const cfg = await getSiteConfigMemoryFirst()
  return (
    cfg?.skillsDebugEnabled === true &&
    !isSkillsHttpMode(cfg?.aiToolMode) &&
    cfg?.mcpThemeToolsEnabled === true
  )
}

export async function requireAdminOrSkills(
  request: NextRequest,
  adminSession: unknown | null,
): Promise<GuardOk | GuardFail> {
  if (adminSession) {
    return { ok: true, isAdmin: true, mode: 'apikey', scope: null, requestId: null, aiClientId: null }
  }

  if (!hasLlmSkillsHeaders(request)) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }),
    }
  }

  const verification = await verifySkillsRequest(request)
  if (!verification.ok) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: verification.error }, { status: verification.status }),
    }
  }
  return verification
}
