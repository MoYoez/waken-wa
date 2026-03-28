import { NextRequest, NextResponse } from 'next/server'

import { getSession, hashPassword, validatePasswordStrength } from '@/lib/auth'
import prisma from '@/lib/prisma'

async function requireAdmin() {
  const session = await getSession()
  return session ?? null
}

export async function GET() {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ success: false, error: '未授权' }, { status: 401 })
  }

  const users = await prisma.adminUser.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, username: true, createdAt: true },
  })
  return NextResponse.json({ success: true, data: users })
}

export async function POST(request: NextRequest) {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ success: false, error: '未授权' }, { status: 401 })
  }

  try {
    const { username, password } = await request.json()
    const name = String(username ?? '').trim()
    const rawPassword = String(password ?? '')
    if (!name || !rawPassword) {
      return NextResponse.json({ success: false, error: '请填写用户名和密码' }, { status: 400 })
    }
    const pwError = validatePasswordStrength(rawPassword)
    if (pwError) {
      return NextResponse.json({ success: false, error: pwError }, { status: 400 })
    }

    const passwordHash = await hashPassword(rawPassword)
    const user = await prisma.adminUser.create({
      data: { username: name, passwordHash },
      select: { id: true, username: true, createdAt: true },
    })
    return NextResponse.json({ success: true, data: user }, { status: 201 })
  } catch (error) {
    console.error('创建管理员失败:', error)
    return NextResponse.json({ success: false, error: '创建失败（用户名可能已存在）' }, { status: 500 })
  }
}
