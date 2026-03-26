import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ success: false, error: '未登录' }, { status: 401 })
  }

  const { id } = await params
  const userId = parseInt(id, 10)
  if (isNaN(userId)) {
    return NextResponse.json({ success: false, error: '无效的用户 ID' }, { status: 400 })
  }

  // 不能删除自己
  if (userId === session.userId) {
    return NextResponse.json({ success: false, error: '不能删除当前登录的账户' }, { status: 400 })
  }

  // 至少保留一个管理员
  const count = await prisma.adminUser.count()
  if (count <= 1) {
    return NextResponse.json({ success: false, error: '至少需要保留一个管理员账户' }, { status: 400 })
  }

  const user = await prisma.adminUser.findUnique({ where: { id: userId } })
  if (!user) {
    return NextResponse.json({ success: false, error: '用户不存在' }, { status: 404 })
  }

  await prisma.adminUser.delete({ where: { id: userId } })

  return NextResponse.json({ success: true })
}
