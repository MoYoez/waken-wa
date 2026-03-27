import { NextRequest, NextResponse } from 'next/server'
import { hashPassword } from '@/lib/auth'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { normalizeCustomCss } from '@/lib/theme-css'
import { parseThemeCustomSurface } from '@/lib/theme-custom-surface'
import { safeSiteConfigUpsert } from '@/lib/safe-site-config-upsert'
import { DEFAULT_PAGE_TITLE, PAGE_TITLE_MAX_LEN } from '@/lib/default-page-title'

export async function POST(request: NextRequest) {
  try {
    const [adminCount, existingConfig] = await Promise.all([
      prisma.adminUser.count(),
      (prisma as any).siteConfig.findUnique({ where: { id: 1 } }),
    ])
    const hasAdmin = adminCount > 0

    if (hasAdmin && existingConfig) {
      return NextResponse.json(
        { success: false, error: '初始化已完成，请通过后台设置页面修改配置' },
        { status: 403 },
      )
    }

    if (hasAdmin) {
      const session = await getSession()
      if (!session) {
        return NextResponse.json({ success: false, error: '未授权' }, { status: 401 })
      }
    }

    const {
      username,
      password,
      userName,
      userBio,
      avatarUrl,
      userNote,
      themePreset,
      themeCustomSurface,
      customCss,
      historyWindowMinutes,
      appMessageRules,
      appBlacklist,
      appWhitelist,
      appFilterMode,
      appNameOnlyList,
      processStaleSeconds,
      pageLockEnabled,
      pageLockPassword,
      currentlyText,
      earlierText,
      adminText,
      pageTitle,
    } = await request.json()
    const normalizedUsername = String(username ?? '').trim()
    const rawPassword = String(password ?? '')
    const normalizedUserName = String(userName ?? '').trim()
    const normalizedUserBio = String(userBio ?? '').trim()
    const normalizedAvatarUrl = String(avatarUrl ?? '').trim()
    const normalizedUserNote = String(userNote ?? '').trim()
    const normalizedThemePreset = String(themePreset ?? 'basic').trim() || 'basic'
    const normalizedThemeCustomSurface = parseThemeCustomSurface(themeCustomSurface ?? {})
    const normalizedCustomCss = normalizeCustomCss(customCss)
    const parsedWindow = Number(historyWindowMinutes ?? 120)
    const normalizedHistoryWindowMinutes = Number.isFinite(parsedWindow)
      ? Math.min(Math.max(Math.round(parsedWindow), 10), 24 * 60)
      : 120
    const parsedStaleSeconds = Number(processStaleSeconds ?? 500)
    const normalizedProcessStaleSeconds = Number.isFinite(parsedStaleSeconds)
      ? Math.min(Math.max(Math.round(parsedStaleSeconds), 30), 24 * 60 * 60)
      : 500
    const normalizedAppMessageRules = Array.isArray(appMessageRules) ? appMessageRules : []
    const normalizedAppBlacklist = Array.isArray(appBlacklist)
      ? appBlacklist
          .map((item: unknown) => String(item ?? '').trim())
          .filter((item: string) => item.length > 0)
      : []
    const normalizedAppWhitelist = Array.isArray(appWhitelist)
      ? appWhitelist
          .map((item: unknown) => String(item ?? '').trim())
          .filter((item: string) => item.length > 0)
      : []
    const normalizedAppFilterModeRaw = String(appFilterMode ?? 'blacklist').trim().toLowerCase()
    const normalizedAppFilterMode =
      normalizedAppFilterModeRaw === 'whitelist' ? 'whitelist' : 'blacklist'
    const normalizedAppNameOnlyList = Array.isArray(appNameOnlyList)
      ? appNameOnlyList
          .map((item: unknown) => String(item ?? '').trim())
          .filter((item: string) => item.length > 0)
      : []
    const normalizedPageLockEnabled = Boolean(pageLockEnabled)
    const rawPageLockPassword = String(pageLockPassword ?? '').trim()
    const normalizedCurrentlyText = String(currentlyText ?? '').trim() || '当前状态'
    const normalizedEarlierText = String(earlierText ?? '').trim() || '最近的随想录'
    const normalizedAdminText = String(adminText ?? '').trim() || 'admin'
    const normalizedPageTitle = (
      String(pageTitle ?? '').trim() || DEFAULT_PAGE_TITLE
    ).slice(0, PAGE_TITLE_MAX_LEN)

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

    if (
      normalizedPageLockEnabled &&
      !rawPageLockPassword &&
      !existingConfig?.pageLockPasswordHash
    ) {
      return NextResponse.json(
        { success: false, error: '启用页面锁时请设置访问密码' },
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

      const pageLockPasswordHash =
        rawPageLockPassword.length > 0
          ? await bcrypt.hash(rawPageLockPassword, 12)
          : existingConfig?.pageLockPasswordHash ?? null

      await safeSiteConfigUpsert(tx as any, {
        where: { id: 1 },
        update: {
          pageTitle: normalizedPageTitle,
          userName: normalizedUserName,
          userBio: normalizedUserBio,
          avatarUrl: normalizedAvatarUrl,
          userNote: normalizedUserNote,
          themePreset: normalizedThemePreset,
          themeCustomSurface: normalizedThemeCustomSurface,
          customCss: normalizedCustomCss,
          historyWindowMinutes: normalizedHistoryWindowMinutes,
          appMessageRules: normalizedAppMessageRules,
          appBlacklist: normalizedAppBlacklist,
          appWhitelist: normalizedAppWhitelist,
          appFilterMode: normalizedAppFilterMode,
          appNameOnlyList: normalizedAppNameOnlyList,
          processStaleSeconds: normalizedProcessStaleSeconds,
          pageLockEnabled: normalizedPageLockEnabled,
          pageLockPasswordHash,
          currentlyText: normalizedCurrentlyText,
          earlierText: normalizedEarlierText,
          adminText: normalizedAdminText,
        },
        create: {
          id: 1,
          pageTitle: normalizedPageTitle,
          userName: normalizedUserName,
          userBio: normalizedUserBio,
          avatarUrl: normalizedAvatarUrl,
          userNote: normalizedUserNote,
          themePreset: normalizedThemePreset,
          themeCustomSurface: normalizedThemeCustomSurface,
          customCss: normalizedCustomCss,
          historyWindowMinutes: normalizedHistoryWindowMinutes,
          appMessageRules: normalizedAppMessageRules,
          appBlacklist: normalizedAppBlacklist,
          appWhitelist: normalizedAppWhitelist,
          appFilterMode: normalizedAppFilterMode,
          appNameOnlyList: normalizedAppNameOnlyList,
          processStaleSeconds: normalizedProcessStaleSeconds,
          pageLockEnabled: normalizedPageLockEnabled,
          pageLockPasswordHash,
          currentlyText: normalizedCurrentlyText,
          earlierText: normalizedEarlierText,
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
