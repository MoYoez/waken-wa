import { randomBytes } from 'node:crypto'
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import { findActiveApiTokenBySecret, resolveActiveApiTokenFromPlainSecret } from '@/lib/api-token-secret'
import prisma from './prisma'

const JWT_SECRET_DB_KEY = 'jwt_secret'
let cachedJwtSecret: Uint8Array | null = null

/**
 * HS256 key resolution order:
 *   1. JWT_SECRET env var (explicit config, highest priority)
 *   2. DB-persisted secret in `system_secrets` table (shared across all serverless instances)
 *   3. Generate a new random secret → persist to DB so other instances reuse it
 *
 * The resolved value is cached in-memory per process to avoid repeated DB queries.
 */
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

    // Re-read: another instance may have won the race and inserted a different value.
    const saved = await prisma.systemSecret.findUnique({
      where: { key: JWT_SECRET_DB_KEY },
    })
    const finalValue = saved?.value ?? generated
    cachedJwtSecret = new TextEncoder().encode(finalValue)
    return cachedJwtSecret
  } catch (err) {
    // DB not yet migrated / unreachable — fall back to ephemeral secret so the app
    // can still boot (setup / migration pages won't break).
    console.warn('[auth] Failed to load JWT secret from DB, using ephemeral secret:', err)
    cachedJwtSecret = randomBytes(32)
    return cachedJwtSecret
  }
}

export interface SessionPayload {
  userId: number
  username: string
  exp: number
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
  const token = await new SignJWT({ userId, username })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(await getJwtSecretBytes())

  return token
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, await getJwtSecretBytes())
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

export async function authenticateAdmin(
  username: string,
  password: string
): Promise<{ id: number; username: string } | null> {
  const user = await prisma.adminUser.findUnique({
    where: { username }
  })
  
  if (!user) return null
  
  const isValid = await verifyPassword(password, user.passwordHash)
  if (!isValid) return null
  
  return { id: user.id, username: user.username }
}
