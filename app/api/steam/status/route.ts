import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isSiteLockSatisfied } from '@/lib/auth'
import { fetchSteamPlayerStatus, type SteamStatusResponse } from '@/lib/steam'

/**
 * GET /api/steam/status
 *
 * Returns the current Steam player status.
 * Requires site lock to be satisfied (if enabled).
 * API key: SiteConfig.steamApiKey (admin) or env STEAM_API_KEY; never sent to browsers.
 */
export async function GET(): Promise<NextResponse<SteamStatusResponse>> {
  try {
    // Check site lock
    const siteLockOk = await isSiteLockSatisfied()
    if (!siteLockOk) {
      return NextResponse.json(
        { success: false, error: '请先解锁页面' },
        { status: 403 }
      )
    }

    // Get site config
    const config = await (prisma as any).siteConfig.findUnique({
      where: { id: 1 },
      select: {
        steamEnabled: true,
        steamId: true,
        steamApiKey: true,
      },
    })

    if (!config?.steamEnabled) {
      return NextResponse.json(
        { success: false, error: 'Steam 状态未启用' },
        { status: 404 }
      )
    }

    if (!config.steamId) {
      return NextResponse.json(
        { success: false, error: '未配置 Steam ID' },
        { status: 404 }
      )
    }

    const fromDb =
      typeof config.steamApiKey === 'string' && config.steamApiKey.trim()
        ? config.steamApiKey.trim()
        : ''
    const fromEnv = process.env.STEAM_API_KEY?.trim() ?? ''
    const apiKey = fromDb || fromEnv
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: '未配置 Steam API Key（请在网站设置中填写或使用环境变量 STEAM_API_KEY）' },
        { status: 500 }
      )
    }

    // Fetch status from Steam API
    const result = await fetchSteamPlayerStatus(config.steamId, apiKey)

    if (!result.success) {
      return NextResponse.json(result, { status: 500 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('获取 Steam 状态失败:', error)
    return NextResponse.json(
      { success: false, error: '获取 Steam 状态失败' },
      { status: 500 }
    )
  }
}
