import 'server-only'

import { buildCustomSurfaceCss, sanitizeCssUrls } from '@/lib/theme-custom-surface'
import { readBuiltInThemePresetCss } from '@/lib/theme-preset-load'
import type { ThemePreset } from '@/types/theme'

export type { ThemePreset } from '@/types/theme'

function scopeBuiltInPresetCss(css: string): string {
  return css
    .replace(/:root\b/g, ':root:not(.dark)')
    .replace(/(^|\n)\.animated-bg\b/g, '$1html:not(.dark) .animated-bg')
    .replace(/(^|\n)\.floating-orb\b/g, '$1html:not(.dark) .floating-orb')
    .replace(/(^|\n)\.floating-orb-1\b/g, '$1html:not(.dark) .floating-orb-1')
    .replace(/(^|\n)\.floating-orb-2\b/g, '$1html:not(.dark) .floating-orb-2')
    .replace(/(^|\n)\.floating-orb-3\b/g, '$1html:not(.dark) .floating-orb-3')
}

export function getThemePresetCss(
  presetRaw: string | null | undefined,
  themeCustomSurface?: unknown,
): string {
  const preset = (presetRaw || 'basic') as ThemePreset

  if (preset === 'customSurface') {
    return buildCustomSurfaceCss(themeCustomSurface)
  }

  if (preset === 'basic') {
    return ''
  }

  return scopeBuiltInPresetCss(readBuiltInThemePresetCss(preset))
}

export function normalizeCustomCss(input: unknown): string {
  let s = String(input ?? '').slice(0, 20000)
  s = s
    .replace(/[<>]/g, '')
    .replace(/@import/gi, '')
    .replace(/expression\s*\(/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/behavior\s*:/gi, '')
  s = sanitizeCssUrls(s)
  return s
}
