import 'server-only'

import { randomBytes } from 'node:crypto'

import bcrypt from 'bcryptjs'
import { and, desc, eq, gt, isNull } from 'drizzle-orm'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { skillsOauthTokens, systemSecrets } from '@/lib/drizzle-schema'
import { getSiteConfigMemoryFirst } from '@/lib/site-config-cache'
import { sqlDate, sqlTimestamp } from '@/lib/sql-timestamp'

const SKILLS_APIKEY_SECRET_KEY = 'skills_apikey_bcrypt'

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

const HEADER_PREFIX = 'llm-skills-'

function getHeader(request: NextRequest, name: string): string {
  return (request.headers.get(name) ?? '').trim()
}

export function hasLlmSkillsHeaders(request: NextRequest): boolean {
  for (const [k] of request.headers.entries()) {
    if (k.toLowerCase().startsWith(HEADER_PREFIX)) return true
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

async function readSecretValue(key: string): Promise<string | null> {
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

export async function hasSkillsApiKeyConfigured(): Promise<boolean> {
  const v = await readSecretValue(SKILLS_APIKEY_SECRET_KEY)
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
  const plain = randomBytes(32).toString('base64url')
  await setSecretBcrypt(SKILLS_APIKEY_SECRET_KEY, plain)
  return plain
}

export async function revokeAllSkillsOauthTokens(): Promise<void> {
  const now = sqlTimestamp()
  await db
    .update(skillsOauthTokens)
    .set({ revokedAt: now as any })
    .where(isNull(skillsOauthTokens.revokedAt))
}

export async function clearSkillsApiKey(): Promise<void> {
  await db.delete(systemSecrets).where(eq(systemSecrets.key, SKILLS_APIKEY_SECRET_KEY))
}

export async function rotateSkillsOauthToken(
  ttlMs: number,
  aiClientIdRaw: string,
): Promise<{ token: string; expiresAt: Date; aiClientId: string }> {
  const aiClientId = normalizeAiClientId(aiClientIdRaw)
  if (!aiClientId) {
    throw new Error('Missing aiClientId')
  }
  const ms = Number.isFinite(ttlMs) ? Math.max(60_000, Math.round(ttlMs)) : 60 * 60_000
  const token = randomBytes(32).toString('base64url')
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

  const modeFromHeader = parseMode(getHeader(request, 'LLM-Skills-Mode'))
  const token = getHeader(request, 'LLM-Skills-Token')
  const requestId = getHeader(request, 'LLM-Skills-Request-Id') || null
  const scope = parseScope(getHeader(request, 'LLM-Skills-Scope'))
  const aiClientId = normalizeAiClientId(getHeader(request, 'LLM-Skills-AI'))

  const configuredMode = parseMode(String(cfg.skillsAuthMode ?? ''))
  if (!configuredMode) {
    return { ok: false, error: 'Skills 未配置认证模式，请先在后台设置中选择 OAuth 或 APIKEY', status: 503 }
  }
  if (modeFromHeader && modeFromHeader !== configuredMode) {
    return { ok: false, error: '认证模式不匹配，请在后台切换一致的模式', status: 403 }
  }
  const mode = modeFromHeader ?? configuredMode

  if (mode === 'apikey') {
    const r = await verifyBcryptSecret(SKILLS_APIKEY_SECRET_KEY, token)
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

