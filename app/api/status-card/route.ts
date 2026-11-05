import { NextRequest, NextResponse } from 'next/server'

import { ACTIVITY_FEED_DEFAULT_LIMIT } from '@/constants/activity-api'
import { getActivityFeedData } from '@/lib/activity-feed'
import { getSession, isSiteLockSatisfied } from '@/lib/auth'
import { getRequestLanguage } from '@/lib/i18n/request-locale'
import { getT } from '@/lib/i18n/server'
import { getReportedScreenState } from '@/lib/lockapp-reporter'
import { getPublicOrigin } from '@/lib/public-request-url'
import {
  findOngoingOccurrenceAt,
  parseScheduleCoursesJson,
  resolveSchedulePeriodTemplate,
  type ScheduleOccurrence,
} from '@/lib/schedule-courses'
import { getSiteConfigMemoryFirst } from '@/lib/site-config-cache'
import {
  shouldApplyStatusCardInClassOverride,
} from '@/lib/status-card-activity'
import {
  getStatusCardProfile,
  parseStatusCardOptions,
  resolveStatusCardAvatarDataUri,
  resolveStatusCardBackgroundDataUri,
  resolveStatusCardCoverDataUri,
  resolveStatusCardProfileNote,
  selectStatusCardActivity,
} from '@/lib/status-card-data'
import {
  renderStatusCardSvg,
} from '@/lib/status-card-svg'
import { resolveEffectiveTimezone } from '@/lib/timezone'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

function svgResponse(svg: string, status = 200): NextResponse {
  return new NextResponse(svg, {
    status,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

function getOngoingClassOccurrence(
  config: Record<string, unknown> | null | undefined,
): ScheduleOccurrence | null {
  const parsedCourses = parseScheduleCoursesJson(config?.scheduleCourses ?? null)
  if (!parsedCourses.ok || parsedCourses.data.length === 0) return null
  const periodTemplate = resolveSchedulePeriodTemplate(config?.schedulePeriodTemplate ?? null)
  const timezone = resolveEffectiveTimezone(config?.displayTimezone, config?.forceDisplayTimezone)
  return findOngoingOccurrenceAt(parsedCourses.data, new Date(), periodTemplate, timezone)
}

export async function GET(request: NextRequest) {
  try {
    const config = await getSiteConfigMemoryFirst()
    const options = parseStatusCardOptions(request.nextUrl.searchParams, config)
    const profile = getStatusCardProfile(config)
    if (options.showNote) {
      profile.note = await resolveStatusCardProfileNote(config)
    }
    const adminSession = await getSession()
    const statusPageUrl = `${getPublicOrigin(request)}/`

    if (config?.statusCardEnabled !== true && !adminSession) {
      return svgResponse(
        renderStatusCardSvg({
          options,
          profile,
          activity: null,
          avatarDataUri: null,
          coverDataUri: null,
          backgroundDataUri: null,
          statusPageUrl,
          state: 'disabled',
        }),
        404,
      )
    }

    const siteLockOk = await isSiteLockSatisfied()

    if (!siteLockOk && !adminSession) {
      return svgResponse(
        renderStatusCardSvg({
          options,
          profile,
          activity: null,
          avatarDataUri: null,
          coverDataUri: null,
          backgroundDataUri: null,
          statusPageUrl,
          state: 'locked',
        }),
        403,
      )
    }

    const feed = await getActivityFeedData(ACTIVITY_FEED_DEFAULT_LIMIT, {
      forPublicFeed: true,
      includeGeneratedHashKey: true,
    })
    let activity = selectStatusCardActivity(feed, options)
    const screenState = getReportedScreenState(activity?.metadata)
    if (activity && screenState !== null && !activity.statusText && !activity.processName && !activity.processTitle) {
      const { t } = await getT('common', { lng: getRequestLanguage(request) })
      activity = { ...activity, statusText: t(`site.currentStatus.screenState.${screenState}`) }
    }
    const avatarDataUri =
      options.showHeader && options.showAvatar
        ? await resolveStatusCardAvatarDataUri(profile)
        : null
    const coverDataUri =
      options.variant === 'cover'
        ? await resolveStatusCardCoverDataUri(options.coverKey)
        : null
    const backgroundDataUri =
      options.variant === 'signature'
        ? await resolveStatusCardBackgroundDataUri(options.backgroundKey)
        : null
    const ongoingClassOccurrence = options.showInClassStatus ? getOngoingClassOccurrence(config) : null
    const inClassStatusActive = Boolean(
      options.showInClassStatus &&
      activity &&
      shouldApplyStatusCardInClassOverride(activity) &&
      ongoingClassOccurrence,
    )

    return svgResponse(
      renderStatusCardSvg({
        options,
        profile,
        activity,
        avatarDataUri,
        coverDataUri,
        backgroundDataUri,
        inClassStatusActive,
        inClassOccurrence: ongoingClassOccurrence,
        statusPageUrl,
        state: activity ? 'active' : 'empty',
      }),
    )
  } catch (error) {
    console.error('[status-card] render failed:', error)
    const options = parseStatusCardOptions(request.nextUrl.searchParams)
    return svgResponse(
      renderStatusCardSvg({
        options,
        profile: getStatusCardProfile(null),
        activity: null,
        avatarDataUri: null,
        coverDataUri: null,
        backgroundDataUri: null,
        statusPageUrl: `${getPublicOrigin(request)}/`,
        state: 'empty',
      }),
      500,
    )
  }
}
