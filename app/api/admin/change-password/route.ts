import { NextRequest, NextResponse } from 'next/server'
import { getSession, createSession, validatePasswordStrength } from '@/lib/auth'
import { cookies } from 'next/headers'
import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'

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

  const admin = await prisma.adminUser.findUnique({
    where: { id: session.userId },
  })

  if (!admin) {
    return NextResponse.json({ success: false, error: '用户不存在' }, { status: 404 })
  }

  const valid = await bcrypt.compare(currentPassword, admin.passwordHash)
  if (!valid) {
    return NextResponse.json({ success: false, error: '当前密码错误' }, { status: 400 })
  }

  const newHash = await bcrypt.hash(newPassword, 12)
  await prisma.adminUser.update({
    where: { id: session.userId },
    data: { passwordHash: newHash },
  })

  // Issue a fresh session token; the old token on other devices remains valid
  // until it expires (7d). Full revocation would require a token blacklist.
  const newToken = await createSession(session.userId, session.username)
  const cookieStore = await cookies()
  cookieStore.set('session', newToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })

  return NextResponse.json({ success: true })
}
