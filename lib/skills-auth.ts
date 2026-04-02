import 'server-only'

import { randomBytes } from 'node:crypto'

import bcrypt from 'bcryptjs'
import { and, desc, eq, gt, isNull } from 'drizzle-orm'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { skillsOauthTokens, systemSecrets } from '@/lib/drizzle-schema'
import { getSiteConfigMemoryFirst } from '@/lib/site-config-cache'
import {
  SKILLS_AUTHORIZE_CODE_DEFAULT_TTL_MS,
  SKILLS_SECRET_ENV_KEYS,
  SKILLS_HEADER_PREFIX,
  SKILLS_MIN_TOKEN_TTL_MS,
  SKILLS_OAUTH_TOKEN_DEFAULT_TTL_MS,
  SKILLS_SECRET_KEYS,
} from '@/lib/skills-constants'
import { sqlDate, sqlTimestamp } from '@/lib/sql-timestamp'

export type SkillsAuthMode = 'oauth' | 'apikey'
export type SkillsScope = 'feature' | 'theme' | 'content'

type GuardOk = {
  ok: true
  isAdmin: boolean
  mode: SkillsAuthMode
  scope: SkillsScope | null
  requestId: string | null
  aiClientId: string | null
}
type GuardFail = { ok: false; response: NextResponse }

export type SkillsVerifyOk = GuardOk
export type SkillsVerifyFail = { ok: false; error: string; status: number }

function getHeader(request: NextRequest, name: string): string {
  return (request.headers.get(name) ?? '').trim()
}

export function hasLlmSkillsHeaders(request: NextRequest): boolean {
  for (const [k] of request.headers.entries()) {
    if (k.toLowerCase().startsWith(SKILLS_HEADER_PREFIX)) return true
  }
  return false
}

function parseMode(raw: string): SkillsAuthMode | null {
  const v = raw.trim().toLowerCase()
  if (v === 'oauth') return 'oauth'
  if (v === 'apikey') return 'apikey'
  return null
}

function parseScope(raw: string): SkillsScope | null {
  const v = raw.trim().toLowerCase()
  if (v === 'feature') return 'feature'
  if (v === 'theme') return 'theme'
  if (v === 'content') return 'content'
  return null
}

export function normalizeAiClientId(raw: unknown): string {
  const normalized = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .slice(0, 128)
  return normalized
}

function getSkillsAuthorizeCodeSecretKey(code: string): string {
  return `${SKILLS_SECRET_KEYS.skillsOauthAuthorizeCodePrefix}${code}`
}

function getConfiguredSkillsMode(raw: unknown): SkillsAuthMode | null {
  return parseMode(String(raw ?? ''))
}

function isSkillsHttpMode(raw: unknown): boolean {
  return String(raw ?? '').trim().toLowerCase() === 'skills'
}

function createRandomSecretToken(): string {
  return randomBytes(32).toString('base64url')
}

function getEnvSecretValue(secretDbKey: string): string | null {
  let envName: string | null = null
  if (secretDbKey === SKILLS_SECRET_KEYS.skillsApiKey) {
    envName = SKILLS_SECRET_ENV_KEYS.skillsApiKey
  } else if (secretDbKey === SKILLS_SECRET_KEYS.legacyMcpApiKey) {
    envName = SKILLS_SECRET_ENV_KEYS.legacyMcpApiKey
  }
  if (!envName) return null
  const value = String(process.env[envName] ?? '').trim()
  return value || null
}

export function getSkillsSecretEnvStatus(): {
  skillsApiKeyEnvManaged: boolean
  legacyMcpApiKeyEnvManaged: boolean
} {
  return {
    skillsApiKeyEnvManaged: Boolean(getEnvSecretValue(SKILLS_SECRET_KEYS.skillsApiKey)),
    legacyMcpApiKeyEnvManaged: Boolean(getEnvSecretValue(SKILLS_SECRET_KEYS.legacyMcpApiKey)),
  }
}

async function readSecretValue(key: string): Promise<string | null> {
  const fromEnv = getEnvSecretValue(key)
  if (fromEnv) return fromEnv
  const [row] = await db
    .select({ value: systemSecrets.value })
    .from(systemSecrets)
    .where(eq(systemSecrets.key, key))
    .limit(1)
  const v = row?.value?.trim()
  return v ? v : null
}

async function setSecretBcrypt(key: string, plain: string): Promise<void> {
  const trimmed = String(plain ?? '').trim()
  if (!trimmed) throw new Error('Empty secret')
  if (trimmed.length > 512) throw new Error('Secret too long')
  const hash = await bcrypt.hash(trimmed, 12)
  await db
    .insert(systemSecrets)
    .values({ key, value: hash })
    .onConflictDoUpdate({ target: systemSecrets.key, set: { value: hash } })
}

async function setSecretValue(key: string, value: string): Promise<void> {
  const trimmedKey = String(key ?? '').trim()
  const normalizedValue = String(value ?? '')
  if (!trimmedKey) throw new Error('Empty secret key')
  if (!normalizedValue) throw new Error('Empty secret value')
  await db
    .insert(systemSecrets)
    .values({ key: trimmedKey, value: normalizedValue })
    .onConflictDoUpdate({ target: systemSecrets.key, set: { value: normalizedValue } })
}

export async function hasSkillsApiKeyConfigured(): Promise<boolean> {
  const v = await readSecretValue(SKILLS_SECRET_KEYS.skillsApiKey)
  return Boolean(v)
}

export async function hasLegacyMcpApiKeyConfigured(): Promise<boolean> {
  const v = await readSecretValue(SKILLS_SECRET_KEYS.legacyMcpApiKey)
  return Boolean(v)
}

export async function hasSkillsOauthTokenConfigured(): Promise<boolean> {
  const now = sqlTimestamp()
  const [row] = await db
    .select({ id: skillsOauthTokens.id })
    .from(skillsOauthTokens)
    .where(
      and(
        gt(skillsOauthTokens.expiresAt, now as any),
        isNull(skillsOauthTokens.revokedAt),
      ),
    )
    .limit(1)
  return Boolean(row?.id)
}

export async function rotateSkillsApiKey(): Promise<string> {
  if (getEnvSecretValue(SKILLS_SECRET_KEYS.skillsApiKey)) {
    throw new Error('SKILLS_API_KEY is env-managed')
  }
  const plain = createRandomSecretToken()
  await setSecretBcrypt(SKILLS_SECRET_KEYS.skillsApiKey, plain)
  return plain
}

export async function rotateLegacyMcpApiKey(): Promise<string> {
  if (getEnvSecretValue(SKILLS_SECRET_KEYS.legacyMcpApiKey)) {
    throw new Error('LEGACY_MCP_API_KEY is env-managed')
  }
  const plain = createRandomSecretToken()
  await setSecretBcrypt(SKILLS_SECRET_KEYS.legacyMcpApiKey, plain)
  return plain
}

export async function createSkillsOauthAuthorizeCode(
  aiClientIdRaw: string,
  ttlMs: number = SKILLS_AUTHORIZE_CODE_DEFAULT_TTL_MS,
): Promise<{ code: string; aiClientId: string; expiresAt: Date }> {
  const aiClientId = normalizeAiClientId(aiClientIdRaw)
  if (!aiClientId) {
    throw new Error('Missing aiClientId')
  }
  const ms = Number.isFinite(ttlMs)
    ? Math.max(SKILLS_MIN_TOKEN_TTL_MS, Math.round(ttlMs))
    : SKILLS_AUTHORIZE_CODE_DEFAULT_TTL_MS
  const code = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + ms)
  await setSecretValue(
    getSkillsAuthorizeCodeSecretKey(code),
    JSON.stringify({
      aiClientId,
      expiresAt: expiresAt.toISOString(),
    }),
  )
  return { code, aiClientId, expiresAt }
}

export async function getSkillsOauthAuthorizeRequest(
  codeRaw: string,
): Promise<{ aiClientId: string; expiresAt: Date } | null> {
  const code = String(codeRaw ?? '').trim().toLowerCase()
  if (!code) return null
  const stored = await readSecretValue(getSkillsAuthorizeCodeSecretKey(code))
  if (!stored) return null
  try {
    const parsed = JSON.parse(stored) as { aiClientId?: unknown; expiresAt?: unknown }
    const aiClientId = normalizeAiClientId(parsed?.aiClientId)
    const expiresAt = new Date(String(parsed?.expiresAt ?? ''))
    if (!aiClientId || Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
      return null
    }
    return { aiClientId, expiresAt }
  } catch {
    return null
  }
}

export async function revokeAllSkillsOauthTokens(): Promise<void> {
  const now = sqlTimestamp()
  await db
    .update(skillsOauthTokens)
    .set({ revokedAt: now as any })
    .where(isNull(skillsOauthTokens.revokedAt))
}

export async function clearSkillsApiKey(): Promise<void> {
  await db.delete(systemSecrets).where(eq(systemSecrets.key, SKILLS_SECRET_KEYS.skillsApiKey))
}

export async function verifyLegacyMcpApiKey(token: string): Promise<boolean> {
  const envSecret = getEnvSecretValue(SKILLS_SECRET_KEYS.legacyMcpApiKey)
  if (envSecret) {
    return Boolean(token) && token === envSecret
  }
  const stored = await readSecretValue(SKILLS_SECRET_KEYS.legacyMcpApiKey)
  if (!stored || !token) return false
  return bcrypt.compare(token, stored)
}

export async function isLegacyMcpEnabled(): Promise<boolean> {
  const cfg = await getSiteConfigMemoryFirst()
  return (
    cfg?.skillsDebugEnabled === true &&
    !isSkillsHttpMode(cfg?.aiToolMode) &&
    cfg?.mcpThemeToolsEnabled === true
  )
}

export async function rotateSkillsOauthToken(
  ttlMs: number,
  aiClientIdRaw: string,
): Promise<{ token: string; expiresAt: Date; aiClientId: string }> {
  const aiClientId = normalizeAiClientId(aiClientIdRaw)
  if (!aiClientId) {
    throw new Error('Missing aiClientId')
  }
  const ms = Number.isFinite(ttlMs)
    ? Math.max(SKILLS_MIN_TOKEN_TTL_MS, Math.round(ttlMs))
    : SKILLS_OAUTH_TOKEN_DEFAULT_TTL_MS
  const token = createRandomSecretToken()
  const tokenHash = await bcrypt.hash(token, 12)

  const expiresAt = new Date(Date.now() + ms)
  await db.insert(skillsOauthTokens).values({
    aiClientId,
    tokenHash,
    expiresAt: sqlDate(expiresAt) as any,
  } as any)

  return { token, expiresAt, aiClientId }
}

async function verifyBcryptSecret(
  secretKey: string,
  plain: string,
): Promise<SkillsVerifyFail | { ok: true }> {
  if (!plain) return { ok: false, error: '未授权', status: 401 }
  const envSecret = getEnvSecretValue(secretKey)
  if (envSecret) {
    if (plain !== envSecret) return { ok: false, error: '未授权', status: 401 }
    return { ok: true }
  }
  const stored = await readSecretValue(secretKey)
  if (!stored) return { ok: false, error: '未配置授权信息', status: 503 }
  const ok = await bcrypt.compare(plain, stored)
  if (!ok) return { ok: false, error: '未授权', status: 401 }
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
    return { ok: false, error: '当前已切换为 MCP 模式，Skills HTTP 接口已关闭', status: 403 }
  }

  const modeFromHeader = parseMode(getHeader(request, 'LLM-Skills-Mode'))
  const token = getHeader(request, 'LLM-Skills-Token')
  const requestId = getHeader(request, 'LLM-Skills-Request-Id') || null
  const scope = parseScope(getHeader(request, 'LLM-Skills-Scope'))
  const aiClientId = normalizeAiClientId(getHeader(request, 'LLM-Skills-AI'))

  const configuredMode = getConfiguredSkillsMode(cfg.skillsAuthMode)
  if (!configuredMode) {
    return { ok: false, error: 'Skills 未配置认证模式，请先在后台设置中选择 OAuth 或 APIKEY', status: 503 }
  }
  if (modeFromHeader && modeFromHeader !== configuredMode) {
    return { ok: false, error: '认证模式不匹配，请在后台切换一致的模式', status: 403 }
  }
  const mode = modeFromHeader ?? configuredMode

  if (mode === 'apikey') {
    const r = await verifyBcryptSecret(SKILLS_SECRET_KEYS.skillsApiKey, token)
    if (!r.ok) return r
    return { ok: true, mode, scope, requestId, aiClientId: aiClientId || null, isAdmin: false }
  }
  if (!aiClientId) {
    return { ok: false, error: 'OAuth 模式缺少 AI 标识（LLM-Skills-AI）', status: 401 }
  }
  if (!token) {
    return { ok: false, error: '缺少 token', status: 401 }
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
    return { ok: false, error: 'OAuth 授权不存在或已过期，请重新授权', status: 401 }
  }
  for (const row of candidates) {
    // eslint-disable-next-line no-await-in-loop
    if (await bcrypt.compare(token, row.tokenHash)) {
      return { ok: true, mode, scope, requestId, aiClientId: row.aiClientId, isAdmin: false }
    }
  }
  return { ok: false, error: '未授权', status: 401 }
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
      response: NextResponse.json({ success: false, error: '未授权' }, { status: 401 }),
    }
  }

  const v = await verifySkillsRequest(request)
  if (!v.ok) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: v.error }, { status: v.status }),
    }
  }
  return v
}

