import { NextRequest, NextResponse } from 'next/server'
import { hashPassword } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const hasAdmin = (await prisma.adminUser.count()) > 0

    const {
      username,
      password,
      userName,
      userBio,
      avatarUrl,
      userNote,
      historyWindowMinutes,
      currentlyText,
      earlierText,
      updatesText,
      adminText,
    } = await request.json()
    const normalizedUsername = String(username ?? '').trim()
    const rawPassword = String(password ?? '')
    const normalizedUserName = String(userName ?? '').trim()
    const normalizedUserBio = String(userBio ?? '').trim()
    const normalizedAvatarUrl = String(avatarUrl ?? '').trim()
    const normalizedUserNote = String(userNote ?? '').trim()
    const parsedWindow = Number(historyWindowMinutes ?? 120)
    const normalizedHistoryWindowMinutes = Number.isFinite(parsedWindow)
      ? Math.min(Math.max(Math.round(parsedWindow), 10), 24 * 60)
      : 120
    const normalizedCurrentlyText = String(currentlyText ?? '').trim() || 'currently'
    const normalizedEarlierText = String(earlierText ?? '').trim() || 'earlier'
    const normalizedUpdatesText =
      String(updatesText ?? '').trim() || 'updates every 30 seconds'
    const normalizedAdminText = String(adminText ?? '').trim() || 'admin'

    if (!normalizedUserName || !normalizedUserBio || !normalizedAvatarUrl) {
      return NextResponse.json(
        { success: false, error: '请填写首页必填信息' },
        { status: 400 }
      )
    }

    if (!hasAdmin && (!normalizedUsername || !rawPassword)) {
      return NextResponse.json(
        { success: false, error: '请填写管理员用户名和密码' },
        { status: 400 }
      )
    }

    if (!hasAdmin && rawPassword.length < 6) {
      return NextResponse.json(
        { success: false, error: '密码长度至少 6 位' },
        { status: 400 }
      )
    }

    const result = await prisma.$transaction(async (tx) => {
      let admin: { id: number; username: string } | null = null
      if (!hasAdmin) {
        const passwordHash = await hashPassword(rawPassword)
        admin = await tx.adminUser.create({
          data: {
            username: normalizedUsername,
            passwordHash,
          },
          select: {
            id: true,
            username: true,
          },
        })
      }

      await (tx as any).siteConfig.upsert({
        where: { id: 1 },
        update: {
          userName: normalizedUserName,
          userBio: normalizedUserBio,
          avatarUrl: normalizedAvatarUrl,
          userNote: normalizedUserNote,
          historyWindowMinutes: normalizedHistoryWindowMinutes,
          currentlyText: normalizedCurrentlyText,
          earlierText: normalizedEarlierText,
          updatesText: normalizedUpdatesText,
          adminText: normalizedAdminText,
        },
        create: {
          id: 1,
          userName: normalizedUserName,
          userBio: normalizedUserBio,
          avatarUrl: normalizedAvatarUrl,
          userNote: normalizedUserNote,
          historyWindowMinutes: normalizedHistoryWindowMinutes,
          currentlyText: normalizedCurrentlyText,
          earlierText: normalizedEarlierText,
          updatesText: normalizedUpdatesText,
          adminText: normalizedAdminText,
        },
      })

      return admin
    })

    return NextResponse.json(
      { success: true, data: result, adminCreated: !hasAdmin },
      { status: hasAdmin ? 200 : 201 }
    )
  } catch (error) {
    console.error('初始化管理员失败:', error)
    return NextResponse.json(
      { success: false, error: '初始化管理员失败' },
      { status: 500 }
    )
  }
}
