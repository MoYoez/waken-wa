import { count, desc } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { ActivityFeedProvider } from '@/components/activity-feed-provider'
import { ContentReadingPanel } from '@/components/content-reading-panel'
import { CurrentStatus } from '@/components/current-status'
import { HomeScrollbarHider } from '@/components/home-scrollbar-hider'
import { InspirationHomeSection } from '@/components/inspiration-home-section'
import { LayoutFooterPortal } from '@/components/layout-footer-portal'
import { PublicPageTransitionShell } from '@/components/public-page-transition-shell'
import { ScheduleHomeInClassBanner } from '@/components/schedule-home-in-class-banner'
import { SiteLockForm } from '@/components/site-lock-form'
import { SiteReveal } from '@/components/site-reveal'
import { SiteThemeRuntime } from '@/components/site-theme-runtime'
import { UserProfile, UserProfileNoteSection } from '@/components/user-profile'
import { getActivityFeedData } from '@/lib/activity-feed'
import { normalizeActivityUpdateMode } from '@/lib/activity-update-mode'
import { verifySiteLockSession } from '@/lib/auth'
import { isRemoteAvatarUrl, resolveAvatarUrl } from '@/lib/avatar-url'
import { db } from '@/lib/db'
import { inspirationEntries } from '@/lib/drizzle-schema'
import { getHCaptchaPublicConfig } from '@/lib/hcaptcha'
import {
  normalizeHitokotoCategories,
  normalizeHitokotoEncode,
} from '@/lib/hitokoto'
import {
  parseScheduleCoursesJson,
  resolveSchedulePeriodTemplate,
  type ScheduleCourse,
} from '@/lib/schedule-courses'
import { getSiteConfigMemoryFirst } from '@/lib/site-config-cache'
import {
  SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_DEFAULT,
  SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_MAX_LEN,
} from '@/lib/site-config-constants'
import { getThemePresetCss } from '@/lib/theme-css'
import { coerceDbTimestampToIsoUtc, normalizeTimezone } from '@/lib/timezone'

// Force dynamic rendering so each request gets fresh data.
export const dynamic = 'force-dynamic'

export default async function Home() {
  const config = await getSiteConfigMemoryFirst()
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
  const avatarSrc = resolveAvatarUrl(avatarUrl, config.avatarFetchByServerEnabled === true, 'public')
  const shouldPrefetchAvatar = isRemoteAvatarUrl(avatarUrl)
  const userNote = config.userNote
  const currentlyText = config.currentlyText
  const earlierText = config.earlierText
  const adminText = String(config.adminText ?? '').trim() || 'admin'
  const themePresetCss = getThemePresetCss(config.themePreset, config.themeCustomSurface)
  const customCss = String(config.customCss ?? '')
  const themeCss = `${themePresetCss}\n${customCss}`.trim()

  // Config object for later use
  const cfg = config as Record<string, unknown>

  const [activityInitialFeed, inspirationRows, [countRow]] = await Promise.all([
    getActivityFeedData(undefined, { forPublicFeed: true }),
    db
      .select({
        id: inspirationEntries.id,
        title: inspirationEntries.title,
        content: inspirationEntries.content,
        contentLexical: inspirationEntries.contentLexical,
        imageDataUrl: inspirationEntries.imageDataUrl,
        statusSnapshot: inspirationEntries.statusSnapshot,
        createdAt: inspirationEntries.createdAt,
      })
      .from(inspirationEntries)
      .orderBy(desc(inspirationEntries.createdAt))
      .limit(3),
    db.select({ c: count() }).from(inspirationEntries),
  ])
  const inspirationTotal = Number(countRow?.c ?? 0)
  
  // Timezone for inspiration entries
  const displayTimezoneForEntries = normalizeTimezone(cfg.displayTimezone)
  const inspirationHomeEntries = inspirationRows.map((row: (typeof inspirationRows)[number]) => ({
    ...row,
    createdAt: coerceDbTimestampToIsoUtc(row.createdAt),
    displayTimezone: displayTimezoneForEntries,
  }))

  const scheduleInClassOnHome = Boolean(config.scheduleInClassOnHome)
  const scheduleHomeShowLocation = Boolean(config.scheduleHomeShowLocation)
  const scheduleHomeShowTeacher = Boolean(config.scheduleHomeShowTeacher)
  const scheduleHomeShowNextUpcoming = Boolean(config.scheduleHomeShowNextUpcoming)
  const scheduleHomeAfterClassesLabelRaw = String(cfg.scheduleHomeAfterClassesLabel ?? '').trim()
  const scheduleHomeAfterClassesLabel =
    scheduleHomeAfterClassesLabelRaw.slice(0, SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_MAX_LEN) ||
    SITE_CONFIG_SCHEDULE_HOME_AFTER_CLASSES_LABEL_DEFAULT
  const schedulePeriodTemplate = resolveSchedulePeriodTemplate(cfg.schedulePeriodTemplate ?? null)
  
  let scheduleCoursesForHome: ScheduleCourse[] = []
  if (scheduleInClassOnHome) {
    const parsed = parseScheduleCoursesJson(config.scheduleCourses ?? null)
    if (parsed.ok) {
      scheduleCoursesForHome = parsed.data
    }
  }
  const showScheduleHomeColumn = scheduleInClassOnHome && scheduleCoursesForHome.length > 0

  const hideActivityMedia = Boolean(cfg.hideActivityMedia)
  const pageLoadingEnabled = cfg.pageLoadingEnabled !== false
  const noteHitokotoEnabled = Boolean(cfg.userNoteHitokotoEnabled)
  const noteTypewriterEnabled = Boolean(cfg.userNoteTypewriterEnabled)
  const noteSignatureFontEnabled = Boolean(cfg.userNoteSignatureFontEnabled)
  const noteSignatureFontFamily =
    typeof cfg.userNoteSignatureFontFamily === 'string'
      ? cfg.userNoteSignatureFontFamily.trim()
      : ''
  const noteHitokotoCategories = normalizeHitokotoCategories(cfg.userNoteHitokotoCategories)
  const noteHitokotoEncode = normalizeHitokotoEncode(cfg.userNoteHitokotoEncode)
  const noteHitokotoFallbackToNote = Boolean(cfg.userNoteHitokotoFallbackToNote)
  const activityUpdateMode = normalizeActivityUpdateMode(cfg.activityUpdateMode)

  return (
    <>
      {shouldPrefetchAvatar && avatarSrc ? <link rel="prefetch" href={avatarSrc} as="image" /> : null}
      <HomeScrollbarHider />
      {themeCss && (
        <style
          id="site-theme-override"
          dangerouslySetInnerHTML={{ __html: themeCss }}
        />
      )}
      <SiteThemeRuntime
        themePreset={config.themePreset}
        themeCustomSurface={config.themeCustomSurface}
      />
      {/* Animated Background */}
      <div className="animated-bg">
        <div className="floating-orb floating-orb-1" />
        <div className="floating-orb floating-orb-2" />
        <div className="floating-orb floating-orb-3" />
      </div>
      <PublicPageTransitionShell scope="home" enabled={pageLoadingEnabled}>
        <main className="min-h-screen relative">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-16 pb-40">
            <ContentReadingPanel className="p-5 sm:p-6">
              {/* Profile + current: one activity feed subscription (polling/SSE) for both */}
              <ActivityFeedProvider initialFeed={activityInitialFeed} mode={activityUpdateMode}>
                <div className="flex flex-col gap-4">
                  <SiteReveal delay={0.04}>
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
                          avatarUrl={avatarSrc}
                          profileOnlineAccentColor={config.profileOnlineAccentColor ?? null}
                          profileOnlinePulseEnabled={config.profileOnlinePulseEnabled ?? null}
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
                  </SiteReveal>

                  <SiteReveal delay={0.08}>
                    <UserProfileNoteSection
                      note={userNote}
                      noteHitokotoEnabled={noteHitokotoEnabled}
                      noteTypewriterEnabled={noteTypewriterEnabled}
                      noteSignatureFontEnabled={noteSignatureFontEnabled}
                      noteSignatureFontFamily={noteSignatureFontFamily}
                      noteHitokotoCategories={noteHitokotoCategories}
                      noteHitokotoEncode={noteHitokotoEncode}
                      noteHitokotoFallbackToNote={noteHitokotoFallbackToNote}
                    />
                  </SiteReveal>

                  <SiteReveal delay={0.12}>
                    <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
                  </SiteReveal>

                  <SiteReveal delay={0.16}>
                    <section>
                      <h2 className="text-sm font-semibold text-foreground tracking-tight mb-4">
                        {currentlyText}
                      </h2>
                      <div className="space-y-3">
                        <CurrentStatus hideActivityMedia={hideActivityMedia} />
                      </div>
                    </section>
                  </SiteReveal>
                </div>
              </ActivityFeedProvider>

              {/* Timeline */}
              <SiteReveal delay={0.2}>
                <section className="mt-8">
                  <h2 className="text-sm font-semibold text-foreground tracking-tight mb-6">
                    {earlierText}
                  </h2>
                  <InspirationHomeSection
                    entries={inspirationHomeEntries}
                    showArchiveLink={inspirationTotal > 3}
                  />
                </section>
              </SiteReveal>
            </ContentReadingPanel>
          </div>
        </main>

        <LayoutFooterPortal adminText={adminText} />
      </PublicPageTransitionShell>
    </>
  )
}
