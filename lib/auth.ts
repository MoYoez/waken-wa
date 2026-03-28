import { randomBytes } from 'node:crypto'

import bcrypt from 'bcryptjs'
import { jwtVerify,SignJWT } from 'jose'
import { cookies } from 'next/headers'

import { findActiveApiTokenBySecret, resolveActiveApiTokenFromPlainSecret } from '@/lib/api-token-secret'
import type { SessionPayload } from '@/types/auth'

import prisma from './prisma'

export type { SessionPayload } from '@/types/auth'

let _dummyHash: Promise<string> | null = null
function getDummyHash(): Promise<string> {
  if (!_dummyHash) {
    _dummyHash = bcrypt.hash('timing-safe-dummy-' + randomBytes(8).toString('hex'), 12)
  }
  return _dummyHash
}

const JWT_SECRET_DB_KEY = 'jwt_secret'
let cachedJwtSecret: Uint8Array | null = null

/** JWT secret: env JWT_SECRET, else DB system_secrets, else generate; cached per process. */
async function getJwtSecretBytes(): Promise<Uint8Array> {
  if (cachedJwtSecret) return cachedJwtSecret

  const fromEnv = process.env.JWT_SECRET?.trim()
  if (fromEnv) {
    cachedJwtSecret = new TextEncoder().encode(fromEnv)
    return cachedJwtSecret
  }

  try {
    const row = await prisma.systemSecret.findUnique({
      where: { key: JWT_SECRET_DB_KEY },
    })
    if (row) {
      cachedJwtSecret = new TextEncoder().encode(row.value)
      return cachedJwtSecret
    }

    const generated = randomBytes(48).toString('base64url')
    await prisma.systemSecret.upsert({
      where: { key: JWT_SECRET_DB_KEY },
      update: {},
      create: { key: JWT_SECRET_DB_KEY, value: generated },
    })

    const saved = await prisma.systemSecret.findUnique({
      where: { key: JWT_SECRET_DB_KEY },
    })
    const finalValue = saved?.value ?? generated
    cachedJwtSecret = new TextEncoder().encode(finalValue)
    return cachedJwtSecret
  } catch (err) {
    console.warn('[auth] Failed to load JWT secret from DB, using ephemeral secret:', err)
    cachedJwtSecret = randomBytes(32)
    return cachedJwtSecret
  }
}

interface SiteLockPayload {
  type: 'site_lock'
  exp: number
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function createSession(userId: number, username: string): Promise<string> {
  const token = await new SignJWT({ userId, username, type: 'admin_session' })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(await getJwtSecretBytes())

  return token
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, await getJwtSecretBytes())
    // Reject site-lock tokens being used as admin sessions
    if ((payload as Record<string, unknown>).type === 'site_lock') return null
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}

export async function createSiteLockSession(): Promise<string> {
  return new SignJWT({ type: 'site_lock' })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('1d')
    .sign(await getJwtSecretBytes())
}

export async function verifySiteLockSession(token: string): Promise<SiteLockPayload | null> {
  try {
    const { payload } = await jwtVerify(token, await getJwtSecretBytes())
    if ((payload as any).type !== 'site_lock') return null
    return payload as unknown as SiteLockPayload
  } catch {
    return null
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  if (!token) return null
  return verifySession(token)
}

/** Returns true if the visitor has passed the site lock (or lock is disabled). */
export async function isSiteLockSatisfied(): Promise<boolean> {
  const config = await (prisma as any).siteConfig.findUnique({ where: { id: 1 } })
  if (!config?.pageLockEnabled) return true
  const cookieStore = await cookies()
  const token = cookieStore.get('site_lock')?.value
  if (!token) return false
  const payload = await verifySiteLockSession(token)
  return payload !== null
}

export async function validateApiToken(token: string): Promise<boolean> {
  const row = await findActiveApiTokenBySecret(token)
  return row !== null
}

/** Validates Bearer token and returns token id (updates lastUsedAt). For inspiration device allowlist. */
export async function getBearerApiTokenRecord(
  authHeader: string | null,
): Promise<{ id: number } | null> {
  if (!authHeader?.startsWith('Bearer ')) return null
  const secret = authHeader.slice(7)
  return resolveActiveApiTokenFromPlainSecret(secret)
}

export function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) return '密码长度至少 8 位'
  if (!/[a-zA-Z]/.test(password)) return '密码须包含至少一个字母'
  if (!/\d/.test(password)) return '密码须包含至少一个数字'
  return null
}

export async function authenticateAdmin(
  username: string,
  password: string
): Promise<{ id: number; username: string } | null> {
  const user = await prisma.adminUser.findUnique({
    where: { username }
  })
  
  if (!user) {
    // Perform a dummy bcrypt compare to prevent timing-based user enumeration
    await bcrypt.compare(password, await getDummyHash())
    return null
  }
  
  const isValid = await verifyPassword(password, user.passwordHash)
  if (!isValid) return null
  
  return { id: user.id, username: user.username }
}
