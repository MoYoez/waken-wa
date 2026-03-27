import { randomBytes } from 'node:crypto'
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import prisma from './prisma'

let cachedJwtSecret: Uint8Array | null = null
let loggedDevEphemeralWarning = false

/** HS256 key: env in all environments when set; otherwise ephemeral random bytes in non-production only. */
function getJwtSecretBytes(): Uint8Array {
  if (cachedJwtSecret) {
    return cachedJwtSecret
  }

  const fromEnv = process.env.JWT_SECRET?.trim()
  if (fromEnv) {
    cachedJwtSecret = new TextEncoder().encode(fromEnv)
    return cachedJwtSecret
  }

  if (process.env.NODE_ENV === 'production') {
    console.error(
      '[auth] JWT_SECRET is required in production. Set a long random value in the environment.',
    )
    throw new Error('JWT_SECRET is required in production')
  }

  if (!loggedDevEphemeralWarning) {
    loggedDevEphemeralWarning = true
    console.warn(
      '[auth] WARN: JWT_SECRET is not set. Using an ephemeral secret for this Node process only (sessions reset on restart). Set JWT_SECRET in .env for stable local sessions.',
    )
  }

  cachedJwtSecret = randomBytes(32)
  return cachedJwtSecret
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
    .sign(getJwtSecretBytes())

  return token
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecretBytes())
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}

export async function createSiteLockSession(): Promise<string> {
  return new SignJWT({ type: 'site_lock' })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('1d')
    .sign(getJwtSecretBytes())
}

export async function verifySiteLockSession(token: string): Promise<SiteLockPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecretBytes())
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
  const result = await prisma.apiToken.findFirst({
    where: { token, isActive: true }
  })
  return result !== null
}

/** Validates Bearer token and returns token id (updates lastUsedAt). For inspiration device allowlist. */
export async function getBearerApiTokenRecord(
  authHeader: string | null,
): Promise<{ id: number } | null> {
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice(7)
  const result = await prisma.apiToken.findFirst({
    where: { token, isActive: true },
  })
  if (!result) return null
  await prisma.apiToken.update({
    where: { id: result.id },
    data: { lastUsedAt: new Date() },
  })
  return { id: result.id }
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
