import bcrypt from 'bcryptjs'
import { NextRequest, NextResponse } from 'next/server'

import {
  REDIS_ACTIVITY_FEED_CACHE_TTL_DEFAULT_SECONDS,
} from '@/lib/activity-api-constants'
import { clearActivityFeedDataCache } from '@/lib/activity-feed'
import { normalizeActivityUpdateMode } from '@/lib/activity-update-mode'
import { getSession } from '@/lib/auth'
import { requireAdminOrSkills } from '@/lib/skills-auth'
import {
  isRedisCacheForcedOnServerless,
  mergeRedisCacheAdminFields,
  parseRedisCacheTtlSeconds,
} from '@/lib/cache-runtime-toggle'
import { DEFAULT_PAGE_TITLE, PAGE_TITLE_MAX_LEN } from '@/lib/default-page-title'
import {
  normalizeHitokotoCategories,
  normalizeHitokotoEncode,
} from '@/lib/hitokoto'
import { normalizeInspirationAllowedHashes } from '@/lib/inspiration-device-allowlist'
import { normalizeProfileOnlineAccentColor } from '@/lib/profile-online-accent-color'
import { safeSiteConfigUpsert } from '@/lib/safe-site-config-upsert'
import {
  backfillCoursePeriodIdsFromTemplate,
  defaultSchedulePeriodTemplate,
  isAllowedSlotMinutes,
  MAX_SCHEDULE_ICS_BYTES,
  parseScheduleCoursesJson,
  parseSchedulePeriodTemplateJson,
  validateCoursePeriodIdsAgainstTemplate,
} from '@/lib/schedule-courses'
import {
  defaultScheduleGridByWeekday,
  minIntervalFromGrid,
  normalizeScheduleGridByWeekday,
} from '@/lib/schedule-grid-by-weekday'
import { getSiteConfigMemoryFirst } from '@/lib/site-config-cache'
import {
  parseHistoryWindowMinutes,
  parseProcessStaleSeconds,
  SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_DEFAULT,
  SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_MAX_LEN,
  SITE_CONFIG_SCHEDULE_SLOT_DEFAULT_MINUTES,
} from '@/lib/site-config-constants'
import { normalizeCustomCss } from '@/lib/theme-css'
import { parseThemeCustomSurface } from '@/lib/theme-custom-surface'
import { normalizeTimezone } from '@/lib/timezone'

// 强制动态渲染，禁用缓存
export const dynamic = 'force-dynamic'
export const revalidate = 0

async function requireAdmin() {
  const session = await getSession()
  return session ?? null
}

export async function GET(request: NextRequest) {
  const session = await requireAdmin()
  const guard = await requireAdminOrSkills(request, session)
  if (!guard.ok) return guard.response

  try {
    const config = await getSiteConfigMemoryFirst()
    if (!config) {
      return NextResponse.json({ success: true, data: null })
    }
    const redisAdmin = mergeRedisCacheAdminFields(config)
    const safe = {
      ...config,
      pageLockPasswordHash: undefined,
      hcaptchaSecretKey: config.hcaptchaSecretKey ? '••••••••' : null,
      steamApiKey: config.steamApiKey ? '••••••••' : null,
      useNoSqlAsCacheRedis: redisAdmin.useNoSqlAsCacheRedis,
      redisCacheServerlessForced: redisAdmin.redisCacheServerlessForced,
    }
    return NextResponse.json({ success: true, data: safe })
  } catch (error) {
    console.error('读取站点配置失败:', error)
    return NextResponse.json({ success: false, error: '读取失败' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const session = await requireAdmin()
  const guard = await requireAdminOrSkills(request, session)
  if (!guard.ok) return guard.response

  try {
    const body = await request.json()

    if (!guard.isAdmin) {
      const denied = new Set([
        // Redis config
        'useNoSqlAsCacheRedis',
        'redisCacheTtlSeconds',
        // Status update config
        'activityUpdateMode',
        'processStaleSeconds',
        'historyWindowMinutes',
        // Steam key
        'steamApiKey',
        // Device auto-accept / allowlist
        'autoAcceptNewDevices',
        'inspirationAllowedDeviceHashes',
        // Page lock
        'pageLockEnabled',
        'pageLockPassword',
        // hCaptcha
        'hcaptchaEnabled',
        'hcaptchaSiteKey',
        'hcaptchaSecretKey',
      ])

      const presentDeniedKeys = Object.keys(body ?? {}).filter((k) => denied.has(k))
      if (presentDeniedKeys.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: `该请求包含禁止由 AI Skills 修改的字段: ${presentDeniedKeys.join(', ')}`,
            deniedKeys: presentDeniedKeys,
          },
          { status: 403 },
        )
      }
    }

    const existing = await getSiteConfigMemoryFirst()

    const has = (k: string) => k in body
    const strField = (k: string, fallback: string) => {
      const raw = has(k) ? body[k] : (existing as Record<string, unknown> | null)?.[k]
      return String(raw ?? '').trim() || fallback
    }
    const trimStr = (k: string) => {
      const raw = has(k) ? body[k] : (existing as Record<string, unknown> | null)?.[k]
      return String(raw ?? '').trim()
    }
    const strArr = (k: string): string[] => {
      const raw = has(k) ? body[k] : (existing as Record<string, unknown> | null)?.[k]
      return Array.isArray(raw)
        ? raw.map((item: unknown) => String(item ?? '').trim()).filter((s: string) => s.length > 0)
        : []
    }

    const pageTitle = strField('pageTitle', DEFAULT_PAGE_TITLE).slice(0, PAGE_TITLE_MAX_LEN)
    const userName = trimStr('userName')
    const userBio = trimStr('userBio')
    const avatarUrl = trimStr('avatarUrl')
    const userNote = trimStr('userNote')
    const themePreset = strField('themePreset', 'basic')
    const themeCustomSurface = parseThemeCustomSurface(
      has('themeCustomSurface') ? body.themeCustomSurface : existing?.themeCustomSurface,
    )
    const customCss = normalizeCustomCss(
      has('customCss') ? body.customCss : existing?.customCss,
    )
    const currentlyText = strField('currentlyText', '当前状态')
    const earlierText = strField('earlierText', '最近的随想录')
    const adminText = strField('adminText', 'admin')
    const pageLockEnabled = has('pageLockEnabled')
      ? Boolean(body.pageLockEnabled)
      : Boolean(existing?.pageLockEnabled)
    const autoAcceptNewDevices = has('autoAcceptNewDevices')
      ? Boolean(body.autoAcceptNewDevices)
      : Boolean(existing?.autoAcceptNewDevices)
    const rawPageLockPassword = has('pageLockPassword') ? String(body.pageLockPassword ?? '') : ''
    const appMessageRules = has('appMessageRules')
      ? (Array.isArray(body.appMessageRules) ? body.appMessageRules : [])
      : (Array.isArray(existing?.appMessageRules) ? existing!.appMessageRules : [])
    const appBlacklist = strArr('appBlacklist')
    const appWhitelist = strArr('appWhitelist')
    const appFilterModeRaw = has('appFilterMode')
      ? String(body.appFilterMode ?? 'blacklist').trim().toLowerCase()
      : String(existing?.appFilterMode ?? 'blacklist').trim().toLowerCase()
    const appFilterMode = appFilterModeRaw === 'whitelist' ? 'whitelist' : 'blacklist'
    const appNameOnlyList = strArr('appNameOnlyList')
    const mediaPlaySourceBlocklist = strArr('mediaPlaySourceBlocklist')
    const historyWindowMinutes = parseHistoryWindowMinutes(
      has('historyWindowMinutes') ? body.historyWindowMinutes : existing?.historyWindowMinutes,
    )
    const processStaleSeconds = parseProcessStaleSeconds(
      has('processStaleSeconds') ? body.processStaleSeconds : existing?.processStaleSeconds,
    )

    let captureReportedAppsEnabled = existing?.captureReportedAppsEnabled !== false
    if (
      body.captureReportedAppsEnabled !== undefined &&
      body.captureReportedAppsEnabled !== null
    ) {
      captureReportedAppsEnabled = Boolean(body.captureReportedAppsEnabled)
    }

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
      typeof existing?.scheduleSlotMinutes === 'number'
        ? existing.scheduleSlotMinutes
        : SITE_CONFIG_SCHEDULE_SLOT_DEFAULT_MINUTES
    const existingTemplateParsed = parseSchedulePeriodTemplateJson(
      existing?.schedulePeriodTemplate ?? null,
    )
    let schedulePeriodTemplate = existingTemplateParsed.ok
      ? existingTemplateParsed.data
      : defaultSchedulePeriodTemplate()
    if (body.schedulePeriodTemplate !== undefined) {
      const parsedTemplate = parseSchedulePeriodTemplateJson(body.schedulePeriodTemplate)
      if (!parsedTemplate.ok) {
        return NextResponse.json({ success: false, error: parsedTemplate.error }, { status: 400 })
      }
      schedulePeriodTemplate = parsedTemplate.data
    }
    let scheduleGridByWeekday: unknown = existing?.scheduleGridByWeekday ?? null

    const slotInBody =
      body.scheduleSlotMinutes !== undefined && body.scheduleSlotMinutes !== null
    const gridInBody =
      body.scheduleGridByWeekday !== undefined && body.scheduleGridByWeekday !== null

    if (slotInBody) {
      const s = Number(body.scheduleSlotMinutes)
      if (!isAllowedSlotMinutes(s)) {
        return NextResponse.json(
          { success: false, error: 'Invalid schedule slot (use 15, 30, 45, or 60 minutes)' },
          { status: 400 },
        )
      }
      scheduleSlotMinutes = s
    }

    if (gridInBody) {
      const normalized = normalizeScheduleGridByWeekday(
        body.scheduleGridByWeekday,
        scheduleSlotMinutes,
      )
      if (!normalized.ok) {
        return NextResponse.json({ success: false, error: normalized.error }, { status: 400 })
      }
      scheduleGridByWeekday = normalized.data
      scheduleSlotMinutes = minIntervalFromGrid(normalized.data)
    } else if (slotInBody) {
      scheduleGridByWeekday = defaultScheduleGridByWeekday(scheduleSlotMinutes)
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
    const backfilled = backfillCoursePeriodIdsFromTemplate(scheduleCourses, schedulePeriodTemplate)
    scheduleCourses = backfilled.courses
    const periodValidation = validateCoursePeriodIdsAgainstTemplate(
      scheduleCourses,
      schedulePeriodTemplate,
    )
    if (!periodValidation.ok) {
      return NextResponse.json({ success: false, error: periodValidation.error }, { status: 400 })
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
    let scheduleHomeShowNextUpcoming = Boolean(existing?.scheduleHomeShowNextUpcoming)
    if (
      body.scheduleHomeShowNextUpcoming !== undefined &&
      body.scheduleHomeShowNextUpcoming !== null
    ) {
      scheduleHomeShowNextUpcoming = Boolean(body.scheduleHomeShowNextUpcoming)
    }

    let scheduleHomeAfterClassesLabel = SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_DEFAULT
    const existingLabel = existing?.scheduleHomeAfterClassesLabel
    if (typeof existingLabel === 'string' && existingLabel.trim().length > 0) {
      scheduleHomeAfterClassesLabel = existingLabel.trim().slice(
        0,
        SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_MAX_LEN,
      )
    }
    if (
      body.scheduleHomeAfterClassesLabel !== undefined &&
      body.scheduleHomeAfterClassesLabel !== null
    ) {
      const raw = String(body.scheduleHomeAfterClassesLabel).trim()
      scheduleHomeAfterClassesLabel = (
        raw.length > 0 ? raw : SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_DEFAULT
      ).slice(0, SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_MAX_LEN)
    }

    let appMessageRulesShowProcessName = existing?.appMessageRulesShowProcessName !== false
    if (
      body.appMessageRulesShowProcessName !== undefined &&
      body.appMessageRulesShowProcessName !== null
    ) {
      appMessageRulesShowProcessName = Boolean(body.appMessageRulesShowProcessName)
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

    let hcaptchaEnabled = Boolean(existing?.hcaptchaEnabled)
    if (body.hcaptchaEnabled !== undefined && body.hcaptchaEnabled !== null) {
      hcaptchaEnabled = Boolean(body.hcaptchaEnabled)
    }
    let hcaptchaSiteKey: string | null = existing?.hcaptchaSiteKey ?? null
    if (body.hcaptchaSiteKey !== undefined) {
      hcaptchaSiteKey = typeof body.hcaptchaSiteKey === 'string' && body.hcaptchaSiteKey.trim()
        ? body.hcaptchaSiteKey.trim()
        : null
    }
    let hcaptchaSecretKey: string | null = existing?.hcaptchaSecretKey ?? null
    if (body.hcaptchaSecretKey !== undefined) {
      hcaptchaSecretKey = typeof body.hcaptchaSecretKey === 'string' && body.hcaptchaSecretKey.trim()
        ? body.hcaptchaSecretKey.trim()
        : null
    }

    if (hcaptchaEnabled && (!hcaptchaSiteKey || !hcaptchaSecretKey)) {
      return NextResponse.json(
        { success: false, error: '启用 hCaptcha 时请填写 Site Key 和 Secret Key' },
        { status: 400 },
      )
    }

    let globalMouseTiltEnabled = existing?.globalMouseTiltEnabled === true
    if (body.globalMouseTiltEnabled !== undefined && body.globalMouseTiltEnabled !== null) {
      globalMouseTiltEnabled = Boolean(body.globalMouseTiltEnabled)
    }

    let globalMouseTiltGyroEnabled = existing?.globalMouseTiltGyroEnabled === true
    if (body.globalMouseTiltGyroEnabled !== undefined && body.globalMouseTiltGyroEnabled !== null) {
      globalMouseTiltGyroEnabled = Boolean(body.globalMouseTiltGyroEnabled)
    }

    let hideActivityMedia = existing?.hideActivityMedia === true
    if (body.hideActivityMedia !== undefined && body.hideActivityMedia !== null) {
      hideActivityMedia = Boolean(body.hideActivityMedia)
    }

    // 时区设置
    let displayTimezone = existing?.displayTimezone ?? 'Asia/Shanghai'
    if (body.displayTimezone !== undefined && body.displayTimezone !== null) {
      displayTimezone = normalizeTimezone(body.displayTimezone)
    }

    // 活动状态更新模式
    let activityUpdateMode = existing?.activityUpdateMode ?? 'sse'
    if (body.activityUpdateMode !== undefined && body.activityUpdateMode !== null) {
      activityUpdateMode = normalizeActivityUpdateMode(body.activityUpdateMode)
    }
    let useNoSqlAsCacheRedis = existing?.useNoSqlAsCacheRedis === true
    if (body.useNoSqlAsCacheRedis !== undefined && body.useNoSqlAsCacheRedis !== null) {
      useNoSqlAsCacheRedis = Boolean(body.useNoSqlAsCacheRedis)
    }
    if (isRedisCacheForcedOnServerless()) {
      useNoSqlAsCacheRedis = true
    }
    let redisCacheTtlSeconds = parseRedisCacheTtlSeconds(
      existing?.redisCacheTtlSeconds ?? REDIS_ACTIVITY_FEED_CACHE_TTL_DEFAULT_SECONDS,
    )
    if (body.redisCacheTtlSeconds !== undefined && body.redisCacheTtlSeconds !== null) {
      redisCacheTtlSeconds = parseRedisCacheTtlSeconds(body.redisCacheTtlSeconds)
    }

    // Steam 设置
    let steamEnabled = existing?.steamEnabled ?? false
    if (body.steamEnabled !== undefined) {
      steamEnabled = Boolean(body.steamEnabled)
    }
    let steamId = existing?.steamId ?? null
    if (body.steamId !== undefined) {
      steamId = body.steamId ? String(body.steamId).trim() : null
    }

    const STEAM_API_KEY_MAX_LEN = 128
    let steamApiKey: string | null = existing?.steamApiKey ?? null
    if (body.steamApiKey !== undefined) {
      steamApiKey =
        typeof body.steamApiKey === 'string' && body.steamApiKey.trim()
          ? body.steamApiKey.trim().slice(0, STEAM_API_KEY_MAX_LEN)
          : null
    }

    let activityRejectLockappSleep = existing?.activityRejectLockappSleep === true
    if (body.activityRejectLockappSleep !== undefined && body.activityRejectLockappSleep !== null) {
      activityRejectLockappSleep = Boolean(body.activityRejectLockappSleep)
    }

    let profileOnlineAccentColor: string | null =
      normalizeProfileOnlineAccentColor(existing?.profileOnlineAccentColor ?? '') ?? null
    if ('profileOnlineAccentColor' in body) {
      if (body.profileOnlineAccentColor === null || body.profileOnlineAccentColor === '') {
        profileOnlineAccentColor = null
      } else if (typeof body.profileOnlineAccentColor === 'string') {
        const normalized = normalizeProfileOnlineAccentColor(body.profileOnlineAccentColor)
        if (!normalized) {
          return NextResponse.json(
            { success: false, error: '无效的头像在线色（需 #RRGGBB）' },
            { status: 400 },
          )
        }
        profileOnlineAccentColor = normalized
      }
    }

    let profileOnlinePulseEnabled = existing?.profileOnlinePulseEnabled !== false
    if (body.profileOnlinePulseEnabled !== undefined && body.profileOnlinePulseEnabled !== null) {
      profileOnlinePulseEnabled = Boolean(body.profileOnlinePulseEnabled)
    }

    await safeSiteConfigUpsert({
      where: { id: 1 },
      update: {
        pageTitle,
        userName,
        userBio,
        avatarUrl,
        profileOnlineAccentColor,
        profileOnlinePulseEnabled,
        userNote,
        userNoteHitokotoEnabled,
        userNoteHitokotoCategories,
        userNoteHitokotoEncode,
        themePreset,
        themeCustomSurface,
        customCss,
        historyWindowMinutes,
        appMessageRules,
        appMessageRulesShowProcessName,
        appBlacklist,
        appWhitelist,
        appFilterMode,
        appNameOnlyList,
        captureReportedAppsEnabled,
        mediaPlaySourceBlocklist,
        processStaleSeconds,
        pageLockEnabled,
        pageLockPasswordHash,
        currentlyText,
        earlierText,
        adminText,
        autoAcceptNewDevices,
        inspirationAllowedDeviceHashes,
        scheduleSlotMinutes,
        schedulePeriodTemplate,
        scheduleGridByWeekday,
        scheduleCourses,
        scheduleIcs,
        scheduleInClassOnHome,
        scheduleHomeShowLocation,
        scheduleHomeShowTeacher,
        scheduleHomeShowNextUpcoming,
        scheduleHomeAfterClassesLabel,
        globalMouseTiltEnabled,
        globalMouseTiltGyroEnabled,
        hideActivityMedia,
        hcaptchaEnabled,
        hcaptchaSiteKey,
        hcaptchaSecretKey,
        displayTimezone,
        activityUpdateMode,
        useNoSqlAsCacheRedis,
        redisCacheTtlSeconds,
        steamEnabled,
        steamId,
        steamApiKey,
        activityRejectLockappSleep,
      },
      create: {
        id: 1,
        pageTitle,
        userName,
        userBio,
        avatarUrl,
        profileOnlineAccentColor,
        profileOnlinePulseEnabled,
        userNote,
        userNoteHitokotoEnabled,
        userNoteHitokotoCategories,
        userNoteHitokotoEncode,
        themePreset,
        themeCustomSurface,
        customCss,
        historyWindowMinutes,
        appMessageRules,
        appMessageRulesShowProcessName,
        appBlacklist,
        appWhitelist,
        appFilterMode,
        appNameOnlyList,
        captureReportedAppsEnabled,
        mediaPlaySourceBlocklist,
        processStaleSeconds,
        pageLockEnabled,
        pageLockPasswordHash,
        currentlyText,
        earlierText,
        adminText,
        autoAcceptNewDevices,
        inspirationAllowedDeviceHashes,
        scheduleSlotMinutes,
        schedulePeriodTemplate,
        scheduleGridByWeekday,
        scheduleCourses,
        scheduleIcs,
        scheduleInClassOnHome,
        scheduleHomeShowLocation,
        scheduleHomeShowTeacher,
        scheduleHomeShowNextUpcoming,
        scheduleHomeAfterClassesLabel,
        globalMouseTiltEnabled,
        globalMouseTiltGyroEnabled,
        hideActivityMedia,
        hcaptchaEnabled,
        hcaptchaSiteKey,
        hcaptchaSecretKey,
        displayTimezone,
        activityUpdateMode,
        useNoSqlAsCacheRedis,
        redisCacheTtlSeconds,
        steamEnabled,
        steamId,
        steamApiKey,
        activityRejectLockappSleep,
      },
    })
    await clearActivityFeedDataCache()

    const config = await getSiteConfigMemoryFirst()
    if (!config) {
      return NextResponse.json({ success: false, error: '站点配置不存在' }, { status: 500 })
    }

    const redisAdminOut = mergeRedisCacheAdminFields(config)
    const safeOut = {
      ...config,
      pageLockPasswordHash: undefined,
      hcaptchaSecretKey: config.hcaptchaSecretKey ? '••••••••' : null,
      steamApiKey: config.steamApiKey ? '••••••••' : null,
      useNoSqlAsCacheRedis: redisAdminOut.useNoSqlAsCacheRedis,
      redisCacheServerlessForced: redisAdminOut.redisCacheServerlessForced,
    }
    return NextResponse.json({ success: true, data: safeOut })
  } catch (error) {
    console.error('更新站点配置失败:', error)
    return NextResponse.json({ success: false, error: '更新失败' }, { status: 500 })
  }
}
