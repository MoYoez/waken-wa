import { desc, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import { requireAdminSession, unauthorizedJson } from '@/lib/admin-api-auth'
import { db } from '@/lib/db'
import { apiTokens } from '@/lib/drizzle-schema'
import {
  normalizeHitokotoCategories,
  normalizeHitokotoEncode,
} from '@/lib/hitokoto'
import {
  backfillCoursePeriodIdsFromTemplate,
  resolveSchedulePeriodTemplate,
} from '@/lib/schedule-courses'
import { resolveScheduleGridByWeekday } from '@/lib/schedule-grid-by-weekday'
import { getSiteConfigMemoryFirst } from '@/lib/site-config-cache'
import {
  SITE_CONFIG_PROCESS_STALE_DEFAULT_SECONDS,
  SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_DEFAULT,
  SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_MAX_LEN,
  SITE_CONFIG_SCHEDULE_SLOT_DEFAULT_MINUTES,
} from '@/lib/site-config-constants'

function getBaseUrl(request: Request): string {
  const envUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim()
  if (envUrl) return envUrl.replace(/\/+$/, '')
  const url = new URL(request.url)
  return `${url.protocol}//${url.host}`
}

export async function GET(request: Request) {
  const session = await requireAdminSession()
  if (!session) {
    return unauthorizedJson()
  }

  try {
    const [cfg, tokens] = await Promise.all([
      getSiteConfigMemoryFirst(),
      db
        .select({
          id: apiTokens.id,
          name: apiTokens.name,
          token: apiTokens.token,
          isActive: apiTokens.isActive,
          createdAt: apiTokens.createdAt,
          lastUsedAt: apiTokens.lastUsedAt,
        })
        .from(apiTokens)
        .orderBy(desc(apiTokens.createdAt)),
    ])

    if (!cfg) {
      return NextResponse.json(
        { success: false, error: '未找到网页配置，请先完成初始化配置' },
        { status: 400 },
      )
    }

    const baseUrl = getBaseUrl(request)
    const schedulePeriodTemplate = resolveSchedulePeriodTemplate(cfg.schedulePeriodTemplate)
    const scheduleCoursesRaw = Array.isArray(cfg.scheduleCourses)
      ? cfg.scheduleCourses
      : []
    const scheduleCourses = backfillCoursePeriodIdsFromTemplate(
      scheduleCoursesRaw,
      schedulePeriodTemplate,
    ).courses

    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      web: {
        pageTitle: cfg.pageTitle,
        userName: cfg.userName,
        userBio: cfg.userBio,
        avatarUrl: cfg.avatarUrl,
        avatarFetchByServerEnabled: cfg.avatarFetchByServerEnabled === true,
        profileOnlineAccentColor: cfg.profileOnlineAccentColor ?? null,
        profileOnlinePulseEnabled: cfg.profileOnlinePulseEnabled !== false,
        userNote: cfg.userNote,
        userNoteHitokotoEnabled: Boolean(cfg.userNoteHitokotoEnabled),
        userNoteHitokotoCategories: normalizeHitokotoCategories(
          cfg.userNoteHitokotoCategories,
        ),
        userNoteHitokotoEncode: normalizeHitokotoEncode(cfg.userNoteHitokotoEncode),
        themePreset: cfg.themePreset,
        themeCustomSurface: cfg.themeCustomSurface,
        customCss: cfg.customCss,
        historyWindowMinutes: cfg.historyWindowMinutes,
        processStaleSeconds: cfg.processStaleSeconds ?? SITE_CONFIG_PROCESS_STALE_DEFAULT_SECONDS,
        appMessageRules: cfg.appMessageRules,
        appMessageRulesShowProcessName: cfg.appMessageRulesShowProcessName !== false,
        appBlacklist: cfg.appBlacklist,
        appWhitelist: cfg.appWhitelist,
        appFilterMode: cfg.appFilterMode,
        appNameOnlyList: cfg.appNameOnlyList,
        captureReportedAppsEnabled: cfg.captureReportedAppsEnabled !== false,
        mediaPlaySourceBlocklist: cfg.mediaPlaySourceBlocklist,
        pageLockEnabled: cfg.pageLockEnabled,
        currentlyText: cfg.currentlyText,
        earlierText: cfg.earlierText,
        adminText: cfg.adminText,
        autoAcceptNewDevices: Boolean(cfg.autoAcceptNewDevices),
        inspirationAllowedDeviceHashes:
          cfg.inspirationAllowedDeviceHashes === null ||
          cfg.inspirationAllowedDeviceHashes === undefined
            ? null
            : cfg.inspirationAllowedDeviceHashes,
        scheduleSlotMinutes: cfg.scheduleSlotMinutes ?? SITE_CONFIG_SCHEDULE_SLOT_DEFAULT_MINUTES,
        schedulePeriodTemplate,
        scheduleGridByWeekday: resolveScheduleGridByWeekday(
          cfg.scheduleGridByWeekday,
          cfg.scheduleSlotMinutes ?? SITE_CONFIG_SCHEDULE_SLOT_DEFAULT_MINUTES,
        ),
        scheduleCourses,
        scheduleIcs: cfg.scheduleIcs ?? null,
        scheduleInClassOnHome: Boolean(cfg.scheduleInClassOnHome),
        scheduleHomeShowLocation: Boolean(cfg.scheduleHomeShowLocation),
        scheduleHomeShowTeacher: Boolean(cfg.scheduleHomeShowTeacher),
        scheduleHomeShowNextUpcoming: Boolean(cfg.scheduleHomeShowNextUpcoming),
        scheduleHomeAfterClassesLabel:
          typeof cfg.scheduleHomeAfterClassesLabel === 'string' &&
          cfg.scheduleHomeAfterClassesLabel.trim().length > 0
            ? cfg.scheduleHomeAfterClassesLabel.trim().slice(
                0,
                SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_MAX_LEN,
              )
            : SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_DEFAULT,
        globalMouseTiltEnabled: cfg.globalMouseTiltEnabled === true,
        globalMouseTiltGyroEnabled: cfg.globalMouseTiltGyroEnabled === true,
        hideActivityMedia: cfg.hideActivityMedia === true,
        activityRejectLockappSleep: cfg.activityRejectLockappSleep === true,
      },
      token: {
        reportEndpoint: `${baseUrl}/api/activity`,
        items: tokens.map((t: {
          id: number
          name: string
          isActive: boolean
          createdAt: Date
          lastUsedAt: Date | null
        }) => ({
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
