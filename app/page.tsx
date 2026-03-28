import { UserProfile } from '@/components/user-profile'
import { CurrentStatus } from '@/components/current-status'
import { InspirationHomeSection } from '@/components/inspiration-home-section'
import prisma from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { verifySiteLockSession } from '@/lib/auth'
import { SiteLockForm } from '@/components/site-lock-form'
import { getHCaptchaPublicConfig } from '@/lib/hcaptcha'
import { getThemePresetCss } from '@/lib/theme-css'
import { LayoutFooterPortal } from '@/components/layout-footer-portal'
import { ContentReadingPanel } from '@/components/content-reading-panel'
import { ScheduleHomeInClassBanner } from '@/components/schedule-home-in-class-banner'
import {
  normalizeHitokotoCategories,
  normalizeHitokotoEncode,
} from '@/lib/hitokoto'
import {
  parseScheduleCoursesJson,
  resolveSchedulePeriodTemplate,
  type ScheduleCourse,
} from '@/lib/schedule-courses'
import { normalizeTimezone } from '@/lib/timezone'
// Activity update mode configuration
import { normalizeActivityUpdateMode } from '@/lib/activity-update-mode'

// 强制动态渲染，确保每次请求都获取最新数据
export const dynamic = 'force-dynamic'

export default async function Home() {
  const config = await (prisma as any).siteConfig.findUnique({ where: { id: 1 } })
  if (!config) {
    redirect('/admin/setup')
  }

  if (config.pageLockEnabled) {
    const cookieStore = await cookies()
    const token = cookieStore.get('site_lock')?.value
    const unlocked = token ? await verifySiteLockSession(token) : null
    if (!unlocked) {
      const hcaptcha = await getHCaptchaPublicConfig()
      return <SiteLockForm hcaptchaEnabled={hcaptcha.enabled} hcaptchaSiteKey={hcaptcha.siteKey} />
    }
  }

  const userName = config.userName
  const userBio = config.userBio
  const avatarUrl = config.avatarUrl
  const userNote = config.userNote
  const currentlyText = config.currentlyText
  const earlierText = config.earlierText
  const adminText = String(config.adminText ?? '').trim() || 'admin'
  const themePresetCss = getThemePresetCss(config.themePreset, config.themeCustomSurface)
  const customCss = String(config.customCss ?? '')
  const themeCss = `${themePresetCss}\n${customCss}`.trim()

  const [inspirationRows, inspirationTotal] = await Promise.all([
    (prisma as any).inspirationEntry.findMany({
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: {
        id: true,
        title: true,
        content: true,
        imageDataUrl: true,
        statusSnapshot: true,
        createdAt: true,
      },
    }),
    (prisma as any).inspirationEntry.count(),
  ])
  const displayTimezoneForEntries = normalizeTimezone((config as Record<string, unknown>).displayTimezone)
  const inspirationHomeEntries = inspirationRows.map((row: { createdAt: Date; [k: string]: unknown }) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
    displayTimezone: displayTimezoneForEntries,
  }))

  const scheduleInClassOnHome = Boolean(config.scheduleInClassOnHome)
  const scheduleHomeShowLocation = Boolean(config.scheduleHomeShowLocation)
  const scheduleHomeShowTeacher = Boolean(config.scheduleHomeShowTeacher)
  const scheduleHomeShowNextUpcoming = Boolean(config.scheduleHomeShowNextUpcoming)
  const scheduleHomeAfterClassesLabelRaw = String(
    (config as Record<string, unknown>).scheduleHomeAfterClassesLabel ?? '',
  ).trim()
  const scheduleHomeAfterClassesLabel =
    scheduleHomeAfterClassesLabelRaw.slice(0, 40) || '正在摸鱼'
  const schedulePeriodTemplate = resolveSchedulePeriodTemplate(
    (config as Record<string, unknown>).schedulePeriodTemplate ?? null,
  )
  let scheduleCoursesForHome: ScheduleCourse[] = []
  if (scheduleInClassOnHome) {
    const parsed = parseScheduleCoursesJson(config.scheduleCourses ?? null)
    if (parsed.ok) {
      scheduleCoursesForHome = parsed.data
    }
  }
  const showScheduleHomeColumn =
    scheduleInClassOnHome && scheduleCoursesForHome.length > 0

  const cfg = config as Record<string, unknown>
  const hideActivityMedia = Boolean(cfg.hideActivityMedia)
  const noteHitokotoEnabled = Boolean(cfg.userNoteHitokotoEnabled)
  const noteHitokotoCategories = normalizeHitokotoCategories(cfg.userNoteHitokotoCategories)
  const noteHitokotoEncode = normalizeHitokotoEncode(cfg.userNoteHitokotoEncode)
  const displayTimezone = normalizeTimezone(cfg.displayTimezone)
  const activityUpdateMode = normalizeActivityUpdateMode(cfg.activityUpdateMode)

  return (
    <>
      {themeCss && (
        <style
          id="site-theme-override"
          dangerouslySetInnerHTML={{ __html: themeCss }}
        />
      )}
      {/* Animated Background */}
      <div className="animated-bg">
        <div className="floating-orb floating-orb-1" />
        <div className="floating-orb floating-orb-2" />
        <div className="floating-orb floating-orb-3" />
      </div>

      <main className="min-h-screen relative">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-16 pb-40">
          <ContentReadingPanel className="p-5 sm:p-6">
            {/* Profile + current: tighter vertical rhythm */}
            <div className="flex flex-col gap-4">
              <div
                className={
                  showScheduleHomeColumn
                    ? 'flex flex-col gap-3 sm:flex-row sm:flex-nowrap sm:items-start sm:gap-4'
                    : 'flex flex-col gap-4'
                }
              >
                <div
                  className={
                    showScheduleHomeColumn
                      ? 'min-w-0 w-full sm:flex-1 sm:basis-0 sm:overflow-hidden'
                      : 'min-w-0 w-full'
                  }
                >
                  <UserProfile
                    name={userName}
                    bio={userBio}
                    avatarUrl={avatarUrl}
                    note={userNote}
                    noteHitokotoEnabled={noteHitokotoEnabled}
                    noteHitokotoCategories={noteHitokotoCategories}
                    noteHitokotoEncode={noteHitokotoEncode}
                  />
                </div>
                {showScheduleHomeColumn ? (
                  <ScheduleHomeInClassBanner
                    courses={scheduleCoursesForHome}
                    showLocation={scheduleHomeShowLocation}
                    showTeacher={scheduleHomeShowTeacher}
                    periodTemplate={schedulePeriodTemplate}
                    showNextUpcoming={scheduleHomeShowNextUpcoming}
                    afterClassesLabel={scheduleHomeAfterClassesLabel}
                    className="w-full sm:w-1/3 sm:min-w-0 sm:shrink-0 sm:basis-1/3"
                  />
                ) : null}
              </div>

              <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

              <section>
                <h2 className="text-sm font-semibold text-foreground tracking-tight mb-4">
                  {currentlyText}
                </h2>
                <CurrentStatus hideActivityMedia={hideActivityMedia} activityUpdateMode={activityUpdateMode} />
              </section>
            </div>

            {/* Timeline */}
            <section className="mt-8">
              <h2 className="text-sm font-semibold text-foreground tracking-tight mb-6">
                {earlierText}
              </h2>
              <InspirationHomeSection
                entries={inspirationHomeEntries}
                showArchiveLink={inspirationTotal > 3}
              />
            </section>
          </ContentReadingPanel>
        </div>
      </main>

      <LayoutFooterPortal adminText={adminText} />
    </>
  )
}

