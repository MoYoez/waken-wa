import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { normalizeCustomCss } from '@/lib/theme-css'
import { parseThemeCustomSurface } from '@/lib/theme-custom-surface'
import { safeSiteConfigUpsert } from '@/lib/safe-site-config-upsert'
import { DEFAULT_PAGE_TITLE, PAGE_TITLE_MAX_LEN } from '@/lib/default-page-title'
import {
  normalizeHitokotoCategories,
  normalizeHitokotoEncode,
} from '@/lib/hitokoto'
import {
  isAllowedSlotMinutes,
  MAX_SCHEDULE_ICS_BYTES,
  parseScheduleCoursesJson,
} from '@/lib/schedule-courses'
import { normalizeInspirationAllowedHashes } from '@/lib/inspiration-device-allowlist'

const SCHEDULE_HOME_AFTER_CLASSES_LABEL_MAX = 40
const DEFAULT_SCHEDULE_HOME_AFTER_CLASSES_LABEL = '正在摸鱼'

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
    const pageTitleRaw = String(body.pageTitle ?? '').trim() || DEFAULT_PAGE_TITLE
    const pageTitle = pageTitleRaw.slice(0, PAGE_TITLE_MAX_LEN)
    const userName = String(body.userName ?? '').trim()
    const userBio = String(body.userBio ?? '').trim()
    const avatarUrl = String(body.avatarUrl ?? '').trim()
    const userNote = String(body.userNote ?? '').trim()
    const themePreset = String(body.themePreset ?? 'basic').trim() || 'basic'
    const themeCustomSurface = parseThemeCustomSurface(body.themeCustomSurface)
    const customCss = normalizeCustomCss(body.customCss)
    const currentlyText = String(body.currentlyText ?? '').trim() || '当前状态'
    const earlierText = String(body.earlierText ?? '').trim() || '最近的随想录'
    const adminText = String(body.adminText ?? '').trim() || 'admin'
    const pageLockEnabled = Boolean(body.pageLockEnabled)
    const autoAcceptNewDevices = Boolean(body.autoAcceptNewDevices)
    const rawPageLockPassword = String(body.pageLockPassword ?? '')
    const appMessageRules = Array.isArray(body.appMessageRules) ? body.appMessageRules : []
    const appBlacklist = Array.isArray(body.appBlacklist)
      ? body.appBlacklist
          .map((item: unknown) => String(item ?? '').trim())
          .filter((item: string) => item.length > 0)
      : []
    const appWhitelist = Array.isArray(body.appWhitelist)
      ? body.appWhitelist
          .map((item: unknown) => String(item ?? '').trim())
          .filter((item: string) => item.length > 0)
      : []
    const appFilterModeRaw = String(body.appFilterMode ?? 'blacklist').trim().toLowerCase()
    const appFilterMode = appFilterModeRaw === 'whitelist' ? 'whitelist' : 'blacklist'
    const appNameOnlyList = Array.isArray(body.appNameOnlyList)
      ? body.appNameOnlyList
          .map((item: unknown) => String(item ?? '').trim())
          .filter((item: string) => item.length > 0)
      : []
    const parsedWindow = Number(body.historyWindowMinutes ?? 120)
    const historyWindowMinutes = Number.isFinite(parsedWindow)
      ? Math.min(Math.max(Math.round(parsedWindow), 10), 24 * 60)
      : 120
    const parsedStaleSeconds = Number(body.processStaleSeconds ?? 500)
    const processStaleSeconds = Number.isFinite(parsedStaleSeconds)
      ? Math.min(Math.max(Math.round(parsedStaleSeconds), 30), 24 * 60 * 60)
      : 500

    const existing = await (prisma as any).siteConfig.findUnique({ where: { id: 1 } })

    let inspirationAllowedDeviceHashes: string[] | null = normalizeInspirationAllowedHashes(
      existing?.inspirationAllowedDeviceHashes ?? null,
    )
    if ('inspirationAllowedDeviceHashes' in body) {
      if (body.inspirationAllowedDeviceHashes === null) {
        inspirationAllowedDeviceHashes = null
      } else if (Array.isArray(body.inspirationAllowedDeviceHashes)) {
        inspirationAllowedDeviceHashes =
          normalizeInspirationAllowedHashes(body.inspirationAllowedDeviceHashes) ?? []
      }
    }

    let scheduleSlotMinutes =
      typeof existing?.scheduleSlotMinutes === 'number' ? existing.scheduleSlotMinutes : 30
    if (body.scheduleSlotMinutes !== undefined && body.scheduleSlotMinutes !== null) {
      const s = Number(body.scheduleSlotMinutes)
      if (!isAllowedSlotMinutes(s)) {
        return NextResponse.json(
          { success: false, error: 'Invalid schedule slot (use 15, 30, 45, or 60 minutes)' },
          { status: 400 },
        )
      }
      scheduleSlotMinutes = s
    }

    let scheduleCoursesParsed = parseScheduleCoursesJson(existing?.scheduleCourses ?? null)
    if (!scheduleCoursesParsed.ok) {
      scheduleCoursesParsed = { ok: true, data: [] }
    }
    let scheduleCourses = scheduleCoursesParsed.data
    if (body.scheduleCourses !== undefined) {
      const parsed = parseScheduleCoursesJson(body.scheduleCourses)
      if (!parsed.ok) {
        return NextResponse.json({ success: false, error: parsed.error }, { status: 400 })
      }
      scheduleCourses = parsed.data
    }

    let scheduleIcs: string | null =
      typeof existing?.scheduleIcs === 'string' && existing.scheduleIcs.length > 0
        ? existing.scheduleIcs
        : null
    if (body.scheduleIcs !== undefined) {
      const raw = body.scheduleIcs === null || body.scheduleIcs === undefined ? '' : String(body.scheduleIcs)
      if (raw.length > MAX_SCHEDULE_ICS_BYTES) {
        return NextResponse.json(
          { success: false, error: `scheduleIcs exceeds ${MAX_SCHEDULE_ICS_BYTES} bytes` },
          { status: 400 },
        )
      }
      scheduleIcs = raw.length > 0 ? raw : null
    }

    let scheduleInClassOnHome = Boolean(existing?.scheduleInClassOnHome)
    if (body.scheduleInClassOnHome !== undefined && body.scheduleInClassOnHome !== null) {
      scheduleInClassOnHome = Boolean(body.scheduleInClassOnHome)
    }
    let scheduleHomeShowLocation = Boolean(existing?.scheduleHomeShowLocation)
    if (body.scheduleHomeShowLocation !== undefined && body.scheduleHomeShowLocation !== null) {
      scheduleHomeShowLocation = Boolean(body.scheduleHomeShowLocation)
    }
    let scheduleHomeShowTeacher = Boolean(existing?.scheduleHomeShowTeacher)
    if (body.scheduleHomeShowTeacher !== undefined && body.scheduleHomeShowTeacher !== null) {
      scheduleHomeShowTeacher = Boolean(body.scheduleHomeShowTeacher)
    }

    let scheduleHomeAfterClassesLabel = DEFAULT_SCHEDULE_HOME_AFTER_CLASSES_LABEL
    const existingLabel = existing?.scheduleHomeAfterClassesLabel
    if (typeof existingLabel === 'string' && existingLabel.trim().length > 0) {
      scheduleHomeAfterClassesLabel = existingLabel.trim().slice(
        0,
        SCHEDULE_HOME_AFTER_CLASSES_LABEL_MAX,
      )
    }
    if (
      body.scheduleHomeAfterClassesLabel !== undefined &&
      body.scheduleHomeAfterClassesLabel !== null
    ) {
      const raw = String(body.scheduleHomeAfterClassesLabel).trim()
      scheduleHomeAfterClassesLabel = (
        raw.length > 0 ? raw : DEFAULT_SCHEDULE_HOME_AFTER_CLASSES_LABEL
      ).slice(0, SCHEDULE_HOME_AFTER_CLASSES_LABEL_MAX)
    }

    let userNoteHitokotoEnabled = Boolean(existing?.userNoteHitokotoEnabled)
    if (body.userNoteHitokotoEnabled !== undefined && body.userNoteHitokotoEnabled !== null) {
      userNoteHitokotoEnabled = Boolean(body.userNoteHitokotoEnabled)
    }

    let userNoteHitokotoCategories = normalizeHitokotoCategories(
      existing?.userNoteHitokotoCategories ?? [],
    )
    if (body.userNoteHitokotoCategories !== undefined) {
      userNoteHitokotoCategories = normalizeHitokotoCategories(body.userNoteHitokotoCategories)
    }

    let userNoteHitokotoEncode = normalizeHitokotoEncode(existing?.userNoteHitokotoEncode)
    if (body.userNoteHitokotoEncode !== undefined && body.userNoteHitokotoEncode !== null) {
      userNoteHitokotoEncode = normalizeHitokotoEncode(body.userNoteHitokotoEncode)
    }

    if (!userName || !userBio || !avatarUrl) {
      return NextResponse.json(
        { success: false, error: '请填写首页必填信息' },
        { status: 400 }
      )
    }

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
        pageTitle,
        userName,
        userBio,
        avatarUrl,
        userNote,
        userNoteHitokotoEnabled,
        userNoteHitokotoCategories,
        userNoteHitokotoEncode,
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
        pageLockPasswordHash,
        currentlyText,
        earlierText,
        adminText,
        autoAcceptNewDevices,
        inspirationAllowedDeviceHashes,
        scheduleSlotMinutes,
        scheduleCourses,
        scheduleIcs,
        scheduleInClassOnHome,
        scheduleHomeShowLocation,
        scheduleHomeShowTeacher,
        scheduleHomeAfterClassesLabel,
      },
      create: {
        id: 1,
        pageTitle,
        userName,
        userBio,
        avatarUrl,
        userNote,
        userNoteHitokotoEnabled,
        userNoteHitokotoCategories,
        userNoteHitokotoEncode,
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
        pageLockPasswordHash,
        currentlyText,
        earlierText,
        adminText,
        autoAcceptNewDevices,
        inspirationAllowedDeviceHashes,
        scheduleSlotMinutes,
        scheduleCourses,
        scheduleIcs,
        scheduleInClassOnHome,
        scheduleHomeShowLocation,
        scheduleHomeShowTeacher,
        scheduleHomeAfterClassesLabel,
      },
    })

    return NextResponse.json({ success: true, data: config })
  } catch (error) {
    console.error('更新站点配置失败:', error)
    return NextResponse.json({ success: false, error: '更新失败' }, { status: 500 })
  }
}
