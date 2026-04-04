import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { PublicPageTransitionShell } from '@/components/public-page-transition-shell'
import { SiteLockForm } from '@/components/site-lock-form'
import { SiteThemeRuntime } from '@/components/site-theme-runtime'
import { verifySiteLockSession } from '@/lib/auth'
import { getHCaptchaPublicConfig } from '@/lib/hcaptcha'
import { getSiteConfigMemoryFirst } from '@/lib/site-config-cache'
import { getThemePresetCss } from '@/lib/theme-css'

export default async function InspirationLayout({ children }: { children: React.ReactNode }) {
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

  const themePresetCss = getThemePresetCss(config.themePreset, config.themeCustomSurface)
  const customCss = String(config.customCss ?? '')
  const themeCss = `${themePresetCss}\n${customCss}`.trim()

  return (
    <>
      {themeCss ? (
        <style id="site-theme-override" dangerouslySetInnerHTML={{ __html: themeCss }} />
      ) : null}
      <SiteThemeRuntime
        themePreset={config.themePreset}
        themeCustomSurface={config.themeCustomSurface}
      />
      <div className="animated-bg">
        <div className="floating-orb floating-orb-1" />
        <div className="floating-orb floating-orb-2" />
        <div className="floating-orb floating-orb-3" />
      </div>
      <PublicPageTransitionShell scope="inspiration">{children}</PublicPageTransitionShell>
    </>
  )
}
