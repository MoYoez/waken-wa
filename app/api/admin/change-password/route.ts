import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

import { resolveCookieSecureFlag } from '@/lib/cookie-security'
import { createSession, getSession, validatePasswordStrength } from '@/lib/auth'
import { db } from '@/lib/db'
import { adminUsers } from '@/lib/drizzle-schema'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ success: false, error: '未登录' }, { status: 401 })
  }

  const { currentPassword, newPassword } = await request.json()

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ success: false, error: '缺少必要参数' }, { status: 400 })
  }

  const pwError = validatePasswordStrength(newPassword)
  if (pwError) {
    return NextResponse.json({ success: false, error: pwError }, { status: 400 })
  }

  const [admin] = await db.select().from(adminUsers).where(eq(adminUsers.id, session.userId)).limit(1)

  if (!admin) {
    return NextResponse.json({ success: false, error: '用户不存在' }, { status: 404 })
  }

  const valid = await bcrypt.compare(currentPassword, admin.passwordHash)
  if (!valid) {
    return NextResponse.json({ success: false, error: '当前密码错误' }, { status: 400 })
  }

  const newHash = await bcrypt.hash(newPassword, 12)
  await db.update(adminUsers).set({ passwordHash: newHash }).where(eq(adminUsers.id, session.userId))

  // Issue a fresh session token; the old token on other devices remains valid
  // until it expires (7d). Full revocation would require a token blacklist.
  const newToken = await createSession(session.userId, session.username)
  const cookieStore = await cookies()
  cookieStore.set('session', newToken, {
    httpOnly: true,
    secure: resolveCookieSecureFlag(request, 'session'),
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })

  return NextResponse.json({ success: true })
}
