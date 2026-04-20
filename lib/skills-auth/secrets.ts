import { randomBytes } from 'node:crypto'

import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { systemSecrets } from '@/lib/drizzle-schema'
import { SKILLS_SECRET_ENV_KEYS, SKILLS_SECRET_KEYS } from '@/lib/skills-constants'

export function createRandomSecretToken(): string {
  return randomBytes(32).toString('base64url')
}

export function getEnvSecretValue(secretDbKey: string): string | null {
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

export async function readSecretValue(key: string): Promise<string | null> {
  const fromEnv = getEnvSecretValue(key)
  if (fromEnv) return fromEnv
  const [row] = await db
    .select({ value: systemSecrets.value })
    .from(systemSecrets)
    .where(eq(systemSecrets.key, key))
    .limit(1)
  const value = row?.value?.trim()
  return value ? value : null
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
  return Boolean(await readSecretValue(SKILLS_SECRET_KEYS.skillsApiKey))
}

export async function hasLegacyMcpApiKeyConfigured(): Promise<boolean> {
  return Boolean(await readSecretValue(SKILLS_SECRET_KEYS.legacyMcpApiKey))
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
