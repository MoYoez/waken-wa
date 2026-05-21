import type { ReactNode } from 'react'

import { AnimatedBackdrop } from '@/components/animated-backdrop'
import { LenisSmoothScroll } from '@/components/lenis-smooth-scroll'
import { PublicPageTransitionShell } from '@/components/public-page-transition-shell'
import { SiteThemeRuntime } from '@/components/site-theme-runtime'
import type { PublicPageShellData } from '@/lib/public-page-shell'
import type { BrowserStartupScope } from '@/types/browser-startup'

type Props = {
  children: ReactNode
  scope: BrowserStartupScope
  shell: PublicPageShellData
  appVersion: string
}

/**
 * Wraps the children with everything every public route needs:
 *   - smooth scroll bootstrap
 *   - inline theme CSS override (preset + customCss)
 *   - SiteThemeRuntime (image-backed surface + palette runtime)
 *   - animated background gradient + floating orbs
 *   - PublicPageTransitionShell (loader gate when an image gate is required)
 */
export function PublicPageShell({ children, scope, shell, appVersion }: Props) {
  return (
    <>
      <LenisSmoothScroll enabled={shell.smoothScrollEnabled} />
      {shell.themeCss ? (
        <style id="site-theme-override" dangerouslySetInnerHTML={{ __html: shell.themeCss }} />
      ) : null}
      <SiteThemeRuntime
        themePreset={shell.config.themePreset}
        themeCustomSurface={shell.config.themeCustomSurface}
      />
      <AnimatedBackdrop />
      <PublicPageTransitionShell
        appVersion={appVersion}
        scope={scope}
        enabled={shell.pageLoadingEnabled}
        imageGateRequired={shell.imageGateRequired}
        fontOptions={shell.fontOptions}
      >
        {children}
      </PublicPageTransitionShell>
    </>
  )
}
