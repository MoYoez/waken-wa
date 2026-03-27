import { UserProfile } from '@/components/user-profile'
import { CurrentStatus } from '@/components/current-status'
import { InspirationHomeSection } from '@/components/inspiration-home-section'
import prisma from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { verifySiteLockSession } from '@/lib/auth'
import { SiteLockForm } from '@/components/site-lock-form'
import { getThemePresetCss } from '@/lib/theme-css'
import { LayoutFooter } from '@/components/layout-footer'
import { ContentReadingPanel } from '@/components/content-reading-panel'

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
      return <SiteLockForm />
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
  const inspirationHomeEntries = inspirationRows.map((row: { createdAt: Date; [k: string]: unknown }) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
  }))

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
        <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-16 pb-24">
          <ContentReadingPanel className="p-5 sm:p-6">
            {/* Profile + current: tighter vertical rhythm */}
            <div className="flex flex-col gap-4">
              <UserProfile
                name={userName}
                bio={userBio}
                avatarUrl={avatarUrl}
                note={userNote}
              />

              <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

              <section>
                <h2 className="text-sm font-semibold text-foreground tracking-tight mb-4">
                  {currentlyText}
                </h2>
                <CurrentStatus />
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

        <LayoutFooter adminText={adminText} />
      </main>
    </>
  )
}

