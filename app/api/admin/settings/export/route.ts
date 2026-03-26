import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'

async function requireAdmin() {
  const session = await getSession()
  return session ?? null
}

function getBaseUrl(headers: Headers): string {
  const host = headers.get('x-forwarded-host') || headers.get('host') || 'localhost:3000'
  const proto = headers.get('x-forwarded-proto') || 'http'
  return `${proto}://${host}`
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

    const baseUrl = getBaseUrl(request.headers)
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      web: {
        userName: siteConfig.userName,
        userBio: siteConfig.userBio,
        avatarUrl: siteConfig.avatarUrl,
        userNote: siteConfig.userNote,
        themePreset: siteConfig.themePreset,
        customCss: siteConfig.customCss,
        historyWindowMinutes: siteConfig.historyWindowMinutes,
        processStaleSeconds: siteConfig.processStaleSeconds ?? 500,
        appMessageRules: siteConfig.appMessageRules,
        appBlacklist: siteConfig.appBlacklist,
        appNameOnlyList: siteConfig.appNameOnlyList,
        pageLockEnabled: siteConfig.pageLockEnabled,
        currentlyText: siteConfig.currentlyText,
        earlierText: siteConfig.earlierText,
        updatesText: siteConfig.updatesText,
        adminText: siteConfig.adminText,
        autoAcceptNewDevices: Boolean(siteConfig.autoAcceptNewDevices),
      },
      token: {
        reportEndpoint: `${baseUrl}/api/activity`,
        items: tokens,
      },
    }

    const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64')
    return NextResponse.json({ success: true, data: { encoded } })
  } catch (error) {
    console.error('导出配置失败:', error)
    return NextResponse.json({ success: false, error: '导出失败' }, { status: 500 })
  }
}
