import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
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

  if (newPassword.length < 6) {
    return NextResponse.json({ success: false, error: '新密码长度至少 6 位' }, { status: 400 })
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

  const newHash = await bcrypt.hash(newPassword, 10)
  await prisma.adminUser.update({
    where: { id: session.userId },
    data: { passwordHash: newHash },
  })

  return NextResponse.json({ success: true })
}
