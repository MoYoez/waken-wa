import { count, eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { adminUsers } from '@/lib/drizzle-schema'
import { getRequestLanguage } from '@/lib/i18n/request-locale'
import { getT } from '@/lib/i18n/server'

export const dynamic = 'force-dynamic'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { t } = await getT('admin', { lng: getRequestLanguage(request) })
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ success: false, error: t('api.users.notLoggedIn') }, { status: 401 })
  }

  const { id } = await params
  const userId = parseInt(id, 10)
  if (isNaN(userId)) {
    return NextResponse.json({ success: false, error: t('api.users.invalidUserId') }, { status: 400 })
  }

  // 不能删除自己
  if (userId === session.userId) {
    return NextResponse.json({ success: false, error: t('api.users.cannotDeleteSelf') }, { status: 400 })
  }

  // 至少保留一个管理员
  const [cntRow] = await db.select({ c: count() }).from(adminUsers)
  const countVal = Number(cntRow?.c ?? 0)
  if (countVal <= 1) {
    return NextResponse.json({ success: false, error: t('account.keepAtLeastOneAdmin') }, { status: 400 })
  }

  const [user] = await db.select().from(adminUsers).where(eq(adminUsers.id, userId)).limit(1)
  if (!user) {
    return NextResponse.json({ success: false, error: t('api.users.userNotFound') }, { status: 404 })
  }

  await db.delete(adminUsers).where(eq(adminUsers.id, userId))

  return NextResponse.json({ success: true })
}
