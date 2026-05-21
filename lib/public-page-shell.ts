import { cookies } from 'next/headers'

import { verifySiteLockSession } from '@/lib/auth'
import { getHCaptchaPublicConfig } from '@/lib/hcaptcha'
import type { PublicPageFontOption } from '@/lib/public-page-font'
import { resolvePublicPageControlFontOptions } from '@/lib/public-page-font'
import { getSiteConfigMemoryFirst } from '@/lib/site-config-cache'
import { getThemePresetCss } from '@/lib/theme-css'
import { resolveThemeImageGateRequired } from '@/lib/theme-custom-surface'
import type { HCaptchaConfig } from '@/types/hcaptcha'

export type PublicPageShellData = {
  config: NonNullable<Awaited<ReturnType<typeof getSiteConfigMemoryFirst>>>
  themeCss: string
  imageGateRequired: boolean
  pageLoadingEnabled: boolean
  smoothScrollEnabled: boolean
  fontOptions: PublicPageFontOption[]
}

export type PublicPageShellResult =
  | { kind: 'redirect-setup' }
  | { kind: 'locked'; hcaptcha: HCaptchaConfig }
  | { kind: 'ready'; shell: PublicPageShellData }

/**
 * Single source of truth for public-route bootstrap. Resolves site config,
 * runs the site-lock guard, computes theme CSS / image-gate / font options.
 *
 * Routes consume the result via a switch on `result.kind`; this is what lets
 * us collapse the two layouts (home + inspiration) onto the same code path.
 */
export async function preparePublicPageShell(): Promise<PublicPageShellResult> {
  const config = await getSiteConfigMemoryFirst()
  if (!config) return { kind: 'redirect-setup' }

  if (config.pageLockEnabled) {
    const cookieStore = await cookies()
    const token = cookieStore.get('site_lock')?.value
    const unlocked = token ? await verifySiteLockSession(token) : null
    if (!unlocked) {
      const hcaptcha = await getHCaptchaPublicConfig()
      return { kind: 'locked', hcaptcha }
    }
  }

  const themePresetCss = getThemePresetCss(config.themePreset, config.themeCustomSurface)
  const customCss = String(config.customCss ?? '')
  const themeCss = `${themePresetCss}\n${customCss}`.trim()
  const imageGateRequired = resolveThemeImageGateRequired(
    config.themePreset,
    config.themeCustomSurface,
  )
  const cfg = config as Record<string, unknown>
  const pageLoadingEnabled = cfg.pageLoadingEnabled !== false
  const smoothScrollEnabled = cfg.smoothScrollEnabled === true
  const fontOptions = resolvePublicPageControlFontOptions(
    cfg.publicFontOptionsEnabled,
    cfg.publicFontOptions,
  )

  return {
    kind: 'ready',
    shell: {
      config,
      themeCss,
      imageGateRequired,
      pageLoadingEnabled,
      smoothScrollEnabled,
      fontOptions,
    },
  }
}
