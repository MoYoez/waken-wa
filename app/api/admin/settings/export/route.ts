import {
  normalizeHitokotoCategories,
  normalizeHitokotoEncode,
} from '@/lib/hitokoto'
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'

async function requireAdmin() {
  const session = await getSession()
  return session ?? null
}

function getBaseUrl(request: Request): string {
  const envUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim()
  if (envUrl) return envUrl.replace(/\/+$/, '')
  const url = new URL(request.url)
  return `${url.protocol}//${url.host}`
}

export async function GET(request: Request) {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ success: false, error: '未授权' }, { status: 401 })
  }

  try {
    const [siteConfig, tokens] = await Promise.all([
      (prisma as any).siteConfig.findUnique({ where: { id: 1 } }),
      prisma.apiToken.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          token: true,
          isActive: true,
          createdAt: true,
          lastUsedAt: true,
        },
      }),
    ])

    if (!siteConfig) {
      return NextResponse.json(
        { success: false, error: '未找到网页配置，请先完成初始化配置' },
        { status: 400 }
      )
    }

    const baseUrl = getBaseUrl(request)
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      web: {
        pageTitle: siteConfig.pageTitle,
        userName: siteConfig.userName,
        userBio: siteConfig.userBio,
        avatarUrl: siteConfig.avatarUrl,
        userNote: siteConfig.userNote,
        userNoteHitokotoEnabled: Boolean(siteConfig.userNoteHitokotoEnabled),
        userNoteHitokotoCategories: normalizeHitokotoCategories(
          siteConfig.userNoteHitokotoCategories,
        ),
        userNoteHitokotoEncode: normalizeHitokotoEncode(siteConfig.userNoteHitokotoEncode),
        themePreset: siteConfig.themePreset,
        themeCustomSurface: siteConfig.themeCustomSurface,
        customCss: siteConfig.customCss,
        historyWindowMinutes: siteConfig.historyWindowMinutes,
        processStaleSeconds: siteConfig.processStaleSeconds ?? 500,
        appMessageRules: siteConfig.appMessageRules,
        appBlacklist: siteConfig.appBlacklist,
        appWhitelist: siteConfig.appWhitelist,
        appFilterMode: siteConfig.appFilterMode,
        appNameOnlyList: siteConfig.appNameOnlyList,
        pageLockEnabled: siteConfig.pageLockEnabled,
        currentlyText: siteConfig.currentlyText,
        earlierText: siteConfig.earlierText,
        adminText: siteConfig.adminText,
        autoAcceptNewDevices: Boolean(siteConfig.autoAcceptNewDevices),
        inspirationAllowedDeviceHashes:
          siteConfig.inspirationAllowedDeviceHashes === null ||
          siteConfig.inspirationAllowedDeviceHashes === undefined
            ? null
            : siteConfig.inspirationAllowedDeviceHashes,
        scheduleSlotMinutes: siteConfig.scheduleSlotMinutes ?? 30,
        scheduleCourses: siteConfig.scheduleCourses ?? [],
        scheduleIcs: siteConfig.scheduleIcs ?? null,
        scheduleInClassOnHome: Boolean(siteConfig.scheduleInClassOnHome),
        scheduleHomeShowLocation: Boolean(siteConfig.scheduleHomeShowLocation),
        scheduleHomeShowTeacher: Boolean(siteConfig.scheduleHomeShowTeacher),
        scheduleHomeAfterClassesLabel:
          typeof siteConfig.scheduleHomeAfterClassesLabel === 'string' &&
          siteConfig.scheduleHomeAfterClassesLabel.trim().length > 0
            ? siteConfig.scheduleHomeAfterClassesLabel.trim().slice(0, 40)
            : '正在摸鱼',
      },
      token: {
        reportEndpoint: `${baseUrl}/api/activity`,
        items: tokens.map((t) => ({
          id: t.id,
          name: t.name,
          isActive: t.isActive,
          createdAt: t.createdAt,
          lastUsedAt: t.lastUsedAt,
          token: null,
        })),
      },
    }

    const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64')
    return NextResponse.json({ success: true, data: { encoded } })
  } catch (error) {
    console.error('导出配置失败:', error)
    return NextResponse.json({ success: false, error: '导出失败' }, { status: 500 })
  }
}
