import { desc, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import {
  SITE_CONFIG_PROCESS_STALE_DEFAULT_SECONDS,
  SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_DEFAULT,
  SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_MAX_LEN,
  SITE_CONFIG_SCHEDULE_SLOT_DEFAULT_MINUTES,
} from '@/constants/site-config'
import { requireAdminSession, unauthorizedJson } from '@/lib/admin-api-auth'
import { db } from '@/lib/db'
import { apiTokens } from '@/lib/drizzle-schema'
import {
  normalizeHitokotoCategories,
  normalizeHitokotoEncode,
} from '@/lib/hitokoto'
import { normalizePublicPageFontOptions } from '@/lib/public-page-font'
import {
  backfillCoursePeriodIdsFromTemplate,
  resolveSchedulePeriodTemplate,
} from '@/lib/schedule-courses'
import { resolveScheduleGridByWeekday } from '@/lib/schedule-grid-by-weekday'
import { getSiteConfigMemoryFirst } from '@/lib/site-config-cache'

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
          bypassSecondaryReview: apiTokens.bypassSecondaryReview,
          bypassSecondaryReviewFirstUseOnly: apiTokens.bypassSecondaryReviewFirstUseOnly,
          bypassSecondaryReviewConsumedAt: apiTokens.bypassSecondaryReviewConsumedAt,
          createdAt: apiTokens.createdAt,
          lastUsedAt: apiTokens.lastUsedAt,
        })
        .from(apiTokens)
        .orderBy(desc(apiTokens.createdAt)),
    ])

    if (!cfg) {
      return NextResponse.json(
        { success: false, error: 'Site configuration not found. Please complete setup first.' },
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
        adminThemeColor: cfg.adminThemeColor ?? null,
        adminBackgroundColor: cfg.adminBackgroundColor ?? null,
        pageTitle: cfg.pageTitle,
        siteIconUrl: cfg.siteIconUrl ?? null,
        userName: cfg.userName,
        userBio: cfg.userBio,
        avatarUrl: cfg.avatarUrl,
        avatarFetchByServerEnabled: cfg.avatarFetchByServerEnabled === true,
        profileOnlineAccentColor: cfg.profileOnlineAccentColor ?? null,
        profileOnlinePulseEnabled: cfg.profileOnlinePulseEnabled !== false,
        userNote: cfg.userNote,
        userNoteHitokotoEnabled: Boolean(cfg.userNoteHitokotoEnabled),
        userNoteTypewriterEnabled: Boolean(cfg.userNoteTypewriterEnabled),
        userNoteSignatureFontEnabled: Boolean(cfg.userNoteSignatureFontEnabled),
        userNoteSignatureFontFamily:
          typeof cfg.userNoteSignatureFontFamily === 'string'
            ? cfg.userNoteSignatureFontFamily.trim()
            : '',
        userNoteHitokotoCategories: normalizeHitokotoCategories(
          cfg.userNoteHitokotoCategories,
        ),
        userNoteHitokotoEncode: normalizeHitokotoEncode(cfg.userNoteHitokotoEncode),
        userNoteHitokotoFallbackToNote: Boolean(cfg.userNoteHitokotoFallbackToNote),
        themePreset: cfg.themePreset,
        themeCustomSurface: cfg.themeCustomSurface,
        publicFontOptionsEnabled: cfg.publicFontOptionsEnabled === true,
        publicFontOptions: normalizePublicPageFontOptions(cfg.publicFontOptions),
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
        captureReportedAppTitleLimit: cfg.captureReportedAppTitleLimit,
        mediaPlaySourceBlocklist: cfg.mediaPlaySourceBlocklist,
        mediaPlaySourceRules: cfg.mediaPlaySourceRules,
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
        smoothScrollEnabled: cfg.smoothScrollEnabled === true,
        hideActivityMedia: cfg.hideActivityMedia === true,
        statusCardEnabled: cfg.statusCardEnabled === true,
        statusCardVariant: cfg.statusCardVariant ?? 'aurora',
        statusCardTag: cfg.statusCardTag ?? null,
        statusCardBackgroundKey: cfg.statusCardBackgroundKey ?? null,
        statusCardBackgroundRev: cfg.statusCardBackgroundRev ?? null,
        statusCardCoverKey: cfg.statusCardCoverKey ?? null,
        statusCardCoverRev: cfg.statusCardCoverRev ?? null,
        statusCardShowHeader: cfg.statusCardShowHeader !== false,
        statusCardShowAvatar: cfg.statusCardShowAvatar !== false,
        statusCardShowName: cfg.statusCardShowName !== false,
        statusCardShowBio: cfg.statusCardShowBio !== false,
        statusCardShowNote: cfg.statusCardShowNote === true,
        statusCardPreferGame: cfg.statusCardPreferGame === true,
        statusCardShowInClassStatus: cfg.statusCardShowInClassStatus === true,
        statusCardWidth: cfg.statusCardWidth ?? 520,
        statusCardHeight: cfg.statusCardHeight ?? 310,
        statusCardRadius: cfg.statusCardRadius ?? 20,
        statusCardBg: cfg.statusCardBg ?? '#FFFFFF',
        statusCardSignatureBg: cfg.statusCardSignatureBg ?? '#F4F0FF',
        statusCardFg: cfg.statusCardFg ?? '#111827',
        statusCardMuted: cfg.statusCardMuted ?? '#6B7280',
        statusCardAccent: cfg.statusCardAccent ?? '#22C55E',
        statusCardBorder: cfg.statusCardBorder ?? '#E5E7EB',
        mediaDisplayShowSource: cfg.mediaDisplayShowSource === true,
        mediaDisplayShowCover: cfg.mediaDisplayShowCover === true,
        mediaDisplayShowAppIcon: cfg.mediaDisplayShowAppIcon === true,
        mediaDisplayShowNcmLink: cfg.mediaDisplayShowNcmLink === true,
        mediaCoverMaxCount: Number.isFinite(Number(cfg.mediaCoverMaxCount))
          ? Math.min(Math.max(Math.round(Number(cfg.mediaCoverMaxCount)), 0), 500)
          : 50,
        hideInspirationOnHome: cfg.hideInspirationOnHome === true,
        activityRejectLockappSleep: cfg.activityRejectLockappSleep === true,
      },
      token: {
        reportEndpoint: `${baseUrl}/api/activity`,
        items: tokens.map((t: {
          id: number
          name: string
          isActive: boolean
          bypassSecondaryReview: boolean | null
          bypassSecondaryReviewFirstUseOnly: boolean | null
          bypassSecondaryReviewConsumedAt: Date | null
          createdAt: Date
          lastUsedAt: Date | null
        }) => ({
          id: t.id,
          name: t.name,
          isActive: t.isActive,
          bypassSecondaryReview: t.bypassSecondaryReview === true,
          bypassSecondaryReviewFirstUseOnly: t.bypassSecondaryReviewFirstUseOnly === true,
          bypassSecondaryReviewConsumedAt: t.bypassSecondaryReviewConsumedAt,
          createdAt: t.createdAt,
          lastUsedAt: t.lastUsedAt,
          token: null,
        })),
      },
    }

    const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64')
    return NextResponse.json({ success: true, data: { encoded } })
  } catch (error) {
    console.error('Failed to export settings:', error)
    return NextResponse.json({ success: false, error: 'Failed to export' }, { status: 500 })
  }
}
