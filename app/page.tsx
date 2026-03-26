import { UserProfile } from '@/components/user-profile'
import { CurrentStatus } from '@/components/current-status'
import { ActivityTimeline } from '@/components/activity-timeline'
import prisma from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { verifySiteLockSession } from '@/lib/auth'
import { SiteLockForm } from '@/components/site-lock-form'
import { getThemePresetCss } from '@/lib/theme-css'

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
  const updatesText = config.updatesText
  const adminText = config.adminText
  const themePresetCss = getThemePresetCss(config.themePreset)
  const customCss = String(config.customCss ?? '')
  const themeCss = `${themePresetCss}\n${customCss}`.trim()

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
        <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-16 pb-24 space-y-8">
          {/* Profile */}
          <UserProfile
            name={userName}
            bio={userBio}
            avatarUrl={avatarUrl}
            note={userNote}
          />

          {/* Divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

          {/* Current Activity Detail */}
          <section>
            <h2 className="text-xs text-muted-foreground uppercase tracking-widest mb-6">
              {currentlyText}
            </h2>
            <CurrentStatus />
          </section>

          {/* Timeline */}
          <section>
            <h2 className="text-xs text-muted-foreground uppercase tracking-widest mb-6">
              {earlierText}
            </h2>
            <ActivityTimeline />
          </section>
        </div>

        {/* Footer */}
        <footer className="border-t border-border/50 mt-16 backdrop-blur-sm">
          <div className="max-w-3xl mx-auto px-4 py-8 sm:px-6">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <p>{updatesText}</p>
              <a href="/admin" className="hover:text-foreground transition-colors">
                {adminText}
              </a>
            </div>
          </div>
        </footer>
      </main>
    </>
  )
}

