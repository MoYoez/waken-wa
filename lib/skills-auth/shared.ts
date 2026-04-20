import type { NextRequest } from 'next/server'

import { SKILLS_HEADER_PREFIX } from '@/lib/skills-constants'
import type { SkillsAuthMode, SkillsScope } from '@/lib/skills-auth/types'

const SKILLS_OAUTH_TOKEN_TTL_MINUTES_DEFAULT = 60
const SKILLS_OAUTH_TOKEN_TTL_MINUTES_MIN = 5
const SKILLS_OAUTH_TOKEN_TTL_MINUTES_MAX = 24 * 60

export function getHeader(request: NextRequest, name: string): string {
  return (request.headers.get(name) ?? '').trim()
}

export function hasLlmSkillsHeaders(request: NextRequest): boolean {
  for (const [key] of request.headers.entries()) {
    if (key.toLowerCase().startsWith(SKILLS_HEADER_PREFIX)) return true
  }
  return false
}

export function parseMode(raw: string): SkillsAuthMode | null {
  const value = raw.trim().toLowerCase()
  if (value === 'oauth') return 'oauth'
  if (value === 'apikey') return 'apikey'
  return null
}

export function parseScope(raw: string): SkillsScope | null {
  const value = raw.trim().toLowerCase()
  if (value === 'feature') return 'feature'
  if (value === 'theme') return 'theme'
  if (value === 'content') return 'content'
  return null
}

export function normalizeAiClientId(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .slice(0, 128)
}

export function normalizeSkillsOauthTokenTtlMinutes(raw: unknown): number {
  const value = Number(raw)
  if (!Number.isFinite(value)) return SKILLS_OAUTH_TOKEN_TTL_MINUTES_DEFAULT
  return Math.min(
    SKILLS_OAUTH_TOKEN_TTL_MINUTES_MAX,
    Math.max(SKILLS_OAUTH_TOKEN_TTL_MINUTES_MIN, Math.round(value)),
  )
}

export function getConfiguredSkillsMode(raw: unknown): SkillsAuthMode | null {
  return parseMode(String(raw ?? ''))
}

export function isSkillsHttpMode(raw: unknown): boolean {
  return String(raw ?? '').trim().toLowerCase() === 'skills'
}
