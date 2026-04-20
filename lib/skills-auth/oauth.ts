import { randomBytes } from 'node:crypto'

import bcrypt from 'bcryptjs'
import { and, desc, eq, gt, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { skillsOauthAuthorizeCodes, skillsOauthTokens } from '@/lib/drizzle-schema'
import { createRandomSecretToken } from '@/lib/skills-auth/secrets'
import { normalizeAiClientId } from '@/lib/skills-auth/shared'
import type {
  SkillsOauthAuthorizeRequest,
  SkillsOauthAuthorizeSummaryRow,
  SkillsOauthExchangeResult,
} from '@/lib/skills-auth/types'
import {
  SKILLS_AUTHORIZE_CODE_DEFAULT_TTL_MS,
  SKILLS_MIN_TOKEN_TTL_MS,
  SKILLS_OAUTH_TOKEN_DEFAULT_TTL_MS,
} from '@/lib/skills-constants'
import { sqlDate, sqlTimestamp } from '@/lib/sql-timestamp'

export async function hasSkillsOauthTokenConfigured(): Promise<boolean> {
  const now = sqlTimestamp()
  const [row] = await db
    .select({ id: skillsOauthTokens.id })
    .from(skillsOauthTokens)
    .where(and(gt(skillsOauthTokens.expiresAt, now as any), isNull(skillsOauthTokens.revokedAt)))
    .limit(1)
  return Boolean(row?.id)
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
  await db.insert(skillsOauthAuthorizeCodes).values({
    authorizeCode: code,
    aiClientId,
    expiresAt: sqlDate(expiresAt) as any,
  } as any)
  return { code, aiClientId, expiresAt }
}

export async function getSkillsOauthAuthorizeRequest(
  codeRaw: string,
): Promise<SkillsOauthAuthorizeRequest | null> {
  const code = String(codeRaw ?? '').trim().toLowerCase()
  if (!code) return null
  const [row] = await db
    .select({
      id: skillsOauthAuthorizeCodes.id,
      aiClientId: skillsOauthAuthorizeCodes.aiClientId,
      expiresAt: skillsOauthAuthorizeCodes.expiresAt,
      approvedAt: skillsOauthAuthorizeCodes.approvedAt,
      approvedBy: skillsOauthAuthorizeCodes.approvedBy,
      exchangeAt: skillsOauthAuthorizeCodes.exchangeAt,
    })
    .from(skillsOauthAuthorizeCodes)
    .where(eq(skillsOauthAuthorizeCodes.authorizeCode, code))
    .limit(1)
  if (!row) return null
  return {
    id: row.id,
    aiClientId: row.aiClientId,
    expiresAt: new Date(row.expiresAt as any),
    approvedAt: row.approvedAt ? new Date(row.approvedAt as any) : null,
    approvedBy: row.approvedBy == null ? null : Number(row.approvedBy),
    exchangeAt: row.exchangeAt ? new Date(row.exchangeAt as any) : null,
  }
}

export async function approveSkillsOauthAuthorizeCode(
  codeRaw: string,
  approvedByRaw: number,
): Promise<{
  aiClientId: string
  approvedAt: Date
  approvedBy: number
  expiresAt: Date
} | null> {
  const request = await getSkillsOauthAuthorizeRequest(codeRaw)
  const approvedBy = Number(approvedByRaw)
  if (!request || !Number.isFinite(approvedBy)) return null
  if (request.expiresAt.getTime() <= Date.now()) return null
  if (request.exchangeAt) return null
  if (request.approvedAt) {
    return {
      aiClientId: request.aiClientId,
      approvedAt: request.approvedAt,
      approvedBy: request.approvedBy ?? approvedBy,
      expiresAt: request.expiresAt,
    }
  }

  const approvedAt = new Date()
  const updated = await db
    .update(skillsOauthAuthorizeCodes)
    .set({
      approvedAt: sqlDate(approvedAt) as any,
      approvedBy,
    } as any)
    .where(
      and(
        eq(skillsOauthAuthorizeCodes.id, request.id),
        isNull(skillsOauthAuthorizeCodes.approvedAt),
        isNull(skillsOauthAuthorizeCodes.exchangeAt),
      ),
    )
    .returning({
      aiClientId: skillsOauthAuthorizeCodes.aiClientId,
      expiresAt: skillsOauthAuthorizeCodes.expiresAt,
    })

  const row = updated[0]
  if (!row) return null
  return {
    aiClientId: row.aiClientId,
    approvedAt,
    approvedBy,
    expiresAt: new Date(row.expiresAt as any),
  }
}

export async function exchangeSkillsOauthCodeForToken(
  codeRaw: string,
  aiClientIdRaw: string,
  ttlMs: number = SKILLS_OAUTH_TOKEN_DEFAULT_TTL_MS,
): Promise<SkillsOauthExchangeResult> {
  const code = String(codeRaw ?? '').trim().toLowerCase()
  if (!code) return { ok: false, reason: 'missing_code' }

  const aiClientId = normalizeAiClientId(aiClientIdRaw)
  if (!aiClientId) return { ok: false, reason: 'missing_ai' }

  const request = await getSkillsOauthAuthorizeRequest(code)
  if (!request) return { ok: false, reason: 'invalid_code' }
  if (request.aiClientId !== aiClientId) return { ok: false, reason: 'ai_mismatch' }
  if (request.expiresAt.getTime() <= Date.now()) return { ok: false, reason: 'expired' }
  if (!request.approvedAt) return { ok: false, reason: 'not_approved' }
  if (request.exchangeAt) return { ok: false, reason: 'already_exchanged' }

  const exchangeAt = new Date()
  const exchanged = await db
    .update(skillsOauthAuthorizeCodes)
    .set({ exchangeAt: sqlDate(exchangeAt) as any })
    .where(and(eq(skillsOauthAuthorizeCodes.id, request.id), isNull(skillsOauthAuthorizeCodes.exchangeAt)))
    .returning({ id: skillsOauthAuthorizeCodes.id })

  if (exchanged.length === 0) {
    return { ok: false, reason: 'already_exchanged' }
  }

  const issued = await rotateSkillsOauthToken(ttlMs, aiClientId)
  return { ok: true, token: issued.token, expiresAt: issued.expiresAt, aiClientId: issued.aiClientId }
}

export async function revokeAllSkillsOauthTokens(): Promise<void> {
  const now = sqlTimestamp()
  await db
    .update(skillsOauthTokens)
    .set({ revokedAt: now as any })
    .where(isNull(skillsOauthTokens.revokedAt))
}

export async function revokeSkillsOauthTokensByAiClientId(aiClientIdRaw: string): Promise<number> {
  const aiClientId = normalizeAiClientId(aiClientIdRaw)
  if (!aiClientId) return 0
  const now = sqlTimestamp()
  const revoked = await db
    .update(skillsOauthTokens)
    .set({ revokedAt: now as any })
    .where(and(eq(skillsOauthTokens.aiClientId, aiClientId), isNull(skillsOauthTokens.revokedAt)))
    .returning({ id: skillsOauthTokens.id })
  return revoked.length
}

export async function listSkillsOauthAuthorizeSummary(): Promise<SkillsOauthAuthorizeSummaryRow[]> {
  const now = Date.now()
  const codes = await db
    .select({
      aiClientId: skillsOauthAuthorizeCodes.aiClientId,
      expiresAt: skillsOauthAuthorizeCodes.expiresAt,
      approvedAt: skillsOauthAuthorizeCodes.approvedAt,
      exchangeAt: skillsOauthAuthorizeCodes.exchangeAt,
    })
    .from(skillsOauthAuthorizeCodes)

  const tokens = await db
    .select({
      aiClientId: skillsOauthTokens.aiClientId,
      expiresAt: skillsOauthTokens.expiresAt,
      revokedAt: skillsOauthTokens.revokedAt,
    })
    .from(skillsOauthTokens)

  const summaryMap = new Map<string, SkillsOauthAuthorizeSummaryRow>()
  const getOrCreate = (aiClientId: string) => {
    const existed = summaryMap.get(aiClientId)
    if (existed) return existed
    const created: SkillsOauthAuthorizeSummaryRow = {
      aiClientId,
      pendingCodeCount: 0,
      approvedCodeCount: 0,
      activeTokenCount: 0,
      lastApprovedAt: null,
      lastExchangedAt: null,
    }
    summaryMap.set(aiClientId, created)
    return created
  }
  const setLatest = (current: string | null, value: Date | null): string | null => {
    if (!value) return current
    const iso = value.toISOString()
    return !current || current < iso ? iso : current
  }

  for (const row of codes) {
    const aiClientId = normalizeAiClientId(row.aiClientId)
    if (!aiClientId) continue
    const item = getOrCreate(aiClientId)
    const expiresAt = new Date(row.expiresAt as any)
    const approvedAt = row.approvedAt ? new Date(row.approvedAt as any) : null
    const exchangeAt = row.exchangeAt ? new Date(row.exchangeAt as any) : null
    item.lastApprovedAt = setLatest(item.lastApprovedAt, approvedAt)
    item.lastExchangedAt = setLatest(item.lastExchangedAt, exchangeAt)

    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= now) continue
    if (exchangeAt) continue
    if (approvedAt) {
      item.approvedCodeCount += 1
      continue
    }
    item.pendingCodeCount += 1
  }

  for (const row of tokens) {
    const aiClientId = normalizeAiClientId(row.aiClientId)
    if (!aiClientId) continue
    const item = getOrCreate(aiClientId)
    const expiresAt = new Date(row.expiresAt as any)
    if (row.revokedAt || Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= now) continue
    item.activeTokenCount += 1
  }

  return Array.from(summaryMap.values()).sort((a, b) => a.aiClientId.localeCompare(b.aiClientId))
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
