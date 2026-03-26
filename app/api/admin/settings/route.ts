import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { normalizeCustomCss } from '@/lib/theme-css'
import { safeSiteConfigUpsert } from '@/lib/safe-site-config-upsert'

// 强制动态渲染，禁用缓存
export const dynamic = 'force-dynamic'
export const revalidate = 0

async function requireAdmin() {
  const session = await getSession()
  return session ?? null
}

export async function GET() {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ success: false, error: '未授权' }, { status: 401 })
  }

  try {
    const config = await (prisma as any).siteConfig.findUnique({ where: { id: 1 } })
    if (!config) {
      return NextResponse.json({ success: true, data: null })
    }
    const safe = {
      ...config,
      pageLockPasswordHash: undefined,
    }
    return NextResponse.json({ success: true, data: safe })
  } catch (error) {
    console.error('读取站点配置失败:', error)
    return NextResponse.json({ success: false, error: '读取失败' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ success: false, error: '未授权' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const userName = String(body.userName ?? '').trim()
    const userBio = String(body.userBio ?? '').trim()
    const avatarUrl = String(body.avatarUrl ?? '').trim()
    const userNote = String(body.userNote ?? '').trim()
    const themePreset = String(body.themePreset ?? 'basic').trim() || 'basic'
    const customCss = normalizeCustomCss(body.customCss)
    const currentlyText = String(body.currentlyText ?? '').trim() || 'currently'
    const earlierText = String(body.earlierText ?? '').trim() || 'earlier'
    const updatesText =
      String(body.updatesText ?? '').trim() || 'updates every 30 seconds'
    const adminText = String(body.adminText ?? '').trim() || 'admin'
    const historyWindowHintText =
      String(body.historyWindowHintText ?? '').trim() ||
      '历史窗口：最近 2 小时（可在设置中调整）'
    const pageLockEnabled = Boolean(body.pageLockEnabled)
    const rawPageLockPassword = String(body.pageLockPassword ?? '')
    const appMessageRules = Array.isArray(body.appMessageRules) ? body.appMessageRules : []
    const parsedWindow = Number(body.historyWindowMinutes ?? 120)
    const historyWindowMinutes = Number.isFinite(parsedWindow)
      ? Math.min(Math.max(Math.round(parsedWindow), 10), 24 * 60)
      : 120
    const parsedStaleSeconds = Number(body.processStaleSeconds ?? 500)
    const processStaleSeconds = Number.isFinite(parsedStaleSeconds)
      ? Math.min(Math.max(Math.round(parsedStaleSeconds), 30), 24 * 60 * 60)
      : 500

    if (!userName || !userBio || !avatarUrl) {
      return NextResponse.json(
        { success: false, error: '请填写首页必填信息' },
        { status: 400 }
      )
    }

    const existing = await (prisma as any).siteConfig.findUnique({ where: { id: 1 } })
    const pageLockPasswordHash =
      rawPageLockPassword.trim().length > 0
        ? await bcrypt.hash(rawPageLockPassword.trim(), 12)
        : existing?.pageLockPasswordHash ?? null

    if (pageLockEnabled && !pageLockPasswordHash) {
      return NextResponse.json(
        { success: false, error: '启用页面锁时请先设置访问密码' },
        { status: 400 }
      )
    }

    const config = await safeSiteConfigUpsert(prisma as any, {
      where: { id: 1 },
      update: {
        userName,
        userBio,
        avatarUrl,
        userNote,
        themePreset,
        customCss,
        historyWindowMinutes,
        historyWindowHintText,
        appMessageRules,
        processStaleSeconds,
        pageLockEnabled,
        pageLockPasswordHash,
        currentlyText,
        earlierText,
        updatesText,
        adminText,
      },
      create: {
        id: 1,
        userName,
        userBio,
        avatarUrl,
        userNote,
        themePreset,
        customCss,
        historyWindowMinutes,
        historyWindowHintText,
        appMessageRules,
        processStaleSeconds,
        pageLockEnabled,
        pageLockPasswordHash,
        currentlyText,
        earlierText,
        updatesText,
        adminText,
      },
    })

    return NextResponse.json({ success: true, data: config })
  } catch (error) {
    console.error('更新站点配置失败:', error)
    return NextResponse.json({ success: false, error: '更新失败' }, { status: 500 })
  }
}
