import { desc } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

import { requireAdminSession, unauthorizedJson } from '@/lib/admin-api-auth'
import { hashPassword, validatePasswordStrength } from '@/lib/auth'
import { db } from '@/lib/db'
import { adminUsers } from '@/lib/drizzle-schema'
import { getRequestLanguage } from '@/lib/i18n/request-locale'
import { getT } from '@/lib/i18n/server'
import { readJsonObject } from '@/lib/request-json'

export async function GET() {
  const session = await requireAdminSession()
  if (!session) {
    return unauthorizedJson()
  }

  const users = await db
    .select({
      id: adminUsers.id,
      username: adminUsers.username,
      createdAt: adminUsers.createdAt,
    })
    .from(adminUsers)
    .orderBy(desc(adminUsers.createdAt))
  return NextResponse.json({ success: true, data: users })
}

export async function POST(request: NextRequest) {
  const session = await requireAdminSession()
  if (!session) {
    return unauthorizedJson()
  }

  try {
    const { t } = await getT('auth', { lng: getRequestLanguage(request) })
    const { username, password } = await readJsonObject(request)
    const name = String(username ?? '').trim()
    const rawPassword = String(password ?? '')
    if (!name || !rawPassword) {
      return NextResponse.json({ success: false, error: t('adminUsers.requiredCredentials') }, { status: 400 })
    }
    const pwError = validatePasswordStrength(rawPassword, t)
    if (pwError) {
      return NextResponse.json({ success: false, error: pwError }, { status: 400 })
    }

    const passwordHash = await hashPassword(rawPassword)
    const [user] = await db
      .insert(adminUsers)
      .values({ username: name, passwordHash })
      .returning({
        id: adminUsers.id,
        username: adminUsers.username,
        createdAt: adminUsers.createdAt,
      })
    return NextResponse.json({ success: true, data: user }, { status: 201 })
  } catch (error) {
    console.error('创建管理员失败:', error)
    const { t } = await getT('auth', { lng: getRequestLanguage(request) })
    return NextResponse.json({ success: false, error: t('adminUsers.createFailed') }, { status: 500 })
  }
}
