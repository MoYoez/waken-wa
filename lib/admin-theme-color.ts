import type { ResolvedTheme } from '@/lib/theme'

const HEX6 = /^#[0-9A-Fa-f]{6}$/

export const ADMIN_THEME_APPEARANCE_EVENT = 'admin-theme-appearance-change'
export const ADMIN_THEME_COLOR_FALLBACK = '#8C6246'
export const ADMIN_BACKGROUND_COLOR_FALLBACK = '#F4EEE6'

export const ADMIN_THEME_VAR_NAMES = [
  '--primary',
  '--primary-foreground',
  '--ring',
  '--accent',
  '--accent-foreground',
  '--sidebar-primary',
  '--sidebar-primary-foreground',
  '--sidebar-ring',
  '--sidebar-accent',
  '--sidebar-accent-foreground',
] as const

export const ADMIN_BACKGROUND_VAR_NAMES = [
  '--background',
  '--foreground',
  '--card',
  '--card-foreground',
  '--popover',
  '--popover-foreground',
  '--secondary',
  '--secondary-foreground',
  '--muted',
  '--muted-foreground',
  '--border',
  '--input',
  '--sidebar',
  '--sidebar-foreground',
  '--sidebar-border',
] as const

export type AdminThemeAppearanceValue = string | null | undefined

export type AdminThemeAppearance = {
  themeColor: AdminThemeAppearanceValue
  backgroundColor: AdminThemeAppearanceValue
}

type Rgb = {
  r: number
  g: number
  b: number
}

type Hsl = {
  h: number
  s: number
  l: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function hexToRgb(hex: string): Rgb | null {
  const normalized = normalizeAdminThemeColor(hex)
  if (!normalized) return null
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  }
}

function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2

  if (max === min) {
    return { h: 0, s: 0, l }
  }

  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0

  switch (max) {
    case rn:
      h = (gn - bn) / d + (gn < bn ? 6 : 0)
      break
    case gn:
      h = (bn - rn) / d + 2
      break
    default:
      h = (rn - gn) / d + 4
      break
  }

  return { h: h / 6, s, l }
}

function hslToRgb({ h, s, l }: Hsl): Rgb {
  if (s === 0) {
    const gray = Math.round(l * 255)
    return { r: gray, g: gray, b: gray }
  }

  const hue2rgb = (p: number, q: number, t: number): number => {
    let next = t
    if (next < 0) next += 1
    if (next > 1) next -= 1
    if (next < 1 / 6) return p + (q - p) * 6 * next
    if (next < 1 / 2) return q
    if (next < 2 / 3) return p + (q - p) * (2 / 3 - next) * 6
    return p
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  return {
    r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  }
}

function toHslCss(hsl: Hsl): string {
  return `hsl(${Math.round(hsl.h * 360)} ${Math.round(hsl.s * 100)}% ${Math.round(hsl.l * 100)}%)`
}

function toHslAlphaCss(hsl: Hsl, alpha: number): string {
  return `hsl(${Math.round(hsl.h * 360)} ${Math.round(hsl.s * 100)}% ${Math.round(hsl.l * 100)}% / ${alpha})`
}

function relativeLuminance({ r, g, b }: Rgb): number {
  const transform = (channel: number) => {
    const value = channel / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }

  return 0.2126 * transform(r) + 0.7152 * transform(g) + 0.0722 * transform(b)
}

export function normalizeAdminThemeColor(raw: unknown): string | null {
  const value = typeof raw === 'string' ? raw.trim() : ''
  if (!value) return null
  if (!HEX6.test(value)) return null
  return value.toUpperCase()
}

function normalizeAppearanceValue(raw: unknown): AdminThemeAppearanceValue {
  if (raw === undefined) return undefined
  if (raw === null || raw === '') return null
  return normalizeAdminThemeColor(raw)
}

function getClientAppearance(): AdminThemeAppearance | null {
  if (typeof window === 'undefined') return null

  type WindowWithAdminThemeAppearance = Window & {
    __wakenAdminThemeAppearance?: AdminThemeAppearance
  }

  const win = window as WindowWithAdminThemeAppearance
  if (!win.__wakenAdminThemeAppearance) {
    win.__wakenAdminThemeAppearance = {
      themeColor: undefined,
      backgroundColor: undefined,
    }
  }
  return win.__wakenAdminThemeAppearance
}

export function readAdminThemeColor(): AdminThemeAppearanceValue {
  return getClientAppearance()?.themeColor
}

export function readAdminBackgroundColor(): AdminThemeAppearanceValue {
  return getClientAppearance()?.backgroundColor
}

export function writeAdminThemeColor(color: AdminThemeAppearanceValue) {
  writeAdminThemeAppearance({ themeColor: color })
}

export function writeAdminBackgroundColor(color: AdminThemeAppearanceValue) {
  writeAdminThemeAppearance({ backgroundColor: color })
}

export function writeAdminThemeAppearance(
  patch: Partial<AdminThemeAppearance>,
): void {
  const state = getClientAppearance()
  if (!state) return

  const nextThemeColor =
    'themeColor' in patch ? normalizeAppearanceValue(patch.themeColor) : state.themeColor
  const nextBackgroundColor =
    'backgroundColor' in patch
      ? normalizeAppearanceValue(patch.backgroundColor)
      : state.backgroundColor

  if (
    nextThemeColor === state.themeColor &&
    nextBackgroundColor === state.backgroundColor
  ) {
    return
  }

  state.themeColor = nextThemeColor
  state.backgroundColor = nextBackgroundColor

  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(ADMIN_THEME_APPEARANCE_EVENT))
}

export function buildAdminThemeVars(
  color: string,
  resolvedTheme: ResolvedTheme,
): Record<(typeof ADMIN_THEME_VAR_NAMES)[number], string> {
  const rgb = hexToRgb(color)
  if (!rgb) {
    return {
      '--primary': '',
      '--primary-foreground': '',
      '--ring': '',
      '--accent': '',
      '--accent-foreground': '',
      '--sidebar-primary': '',
      '--sidebar-primary-foreground': '',
      '--sidebar-ring': '',
      '--sidebar-accent': '',
      '--sidebar-accent-foreground': '',
    }
  }

  const base = rgbToHsl(rgb)
  const isDark = resolvedTheme === 'dark'
  const hue = base.h
  const sat = clamp(base.s, 0.42, 0.88)

  const primary = {
    h: hue,
    s: sat,
    l: isDark ? clamp(Math.max(base.l, 0.62), 0.62, 0.74) : clamp(base.l, 0.36, 0.52),
  }
  const primaryRgb = hslToRgb(primary)
  const primaryForeground =
    relativeLuminance(primaryRgb) > 0.5 ? 'oklch(0.18 0.01 260)' : 'oklch(0.99 0.01 85)'

  const ring = {
    h: hue,
    s: clamp(sat - 0.08, 0.34, 0.82),
    l: isDark ? clamp(primary.l + 0.06, 0.69, 0.82) : clamp(primary.l + 0.08, 0.45, 0.62),
  }
  const accent = {
    h: hue,
    s: clamp(sat - (isDark ? 0.2 : 0.26), 0.12, 0.54),
    l: isDark ? clamp(primary.l - 0.33, 0.2, 0.3) : clamp(primary.l + 0.42, 0.9, 0.97),
  }
  const sidebarAccent = {
    h: hue,
    s: clamp(sat - (isDark ? 0.24 : 0.3), 0.1, 0.46),
    l: isDark ? clamp(primary.l - 0.36, 0.18, 0.28) : clamp(primary.l + 0.38, 0.88, 0.96),
  }

  return {
    '--primary': toHslCss(primary),
    '--primary-foreground': primaryForeground,
    '--ring': toHslCss(ring),
    '--accent': toHslCss(accent),
    '--accent-foreground': isDark ? 'oklch(0.96 0.01 260)' : 'oklch(0.32 0.01 60)',
    '--sidebar-primary': toHslCss(primary),
    '--sidebar-primary-foreground': primaryForeground,
    '--sidebar-ring': toHslCss(ring),
    '--sidebar-accent': toHslCss(sidebarAccent),
    '--sidebar-accent-foreground': isDark ? 'oklch(0.985 0 0)' : 'oklch(0.32 0.01 60)',
  }
}

export function buildAdminBackgroundVars(
  color: string,
): Record<(typeof ADMIN_BACKGROUND_VAR_NAMES)[number], string> {
  const rgb = hexToRgb(color)
  if (!rgb) {
    return {
      '--background': '',
      '--foreground': '',
      '--card': '',
      '--card-foreground': '',
      '--popover': '',
      '--popover-foreground': '',
      '--secondary': '',
      '--secondary-foreground': '',
      '--muted': '',
      '--muted-foreground': '',
      '--border': '',
      '--input': '',
      '--sidebar': '',
      '--sidebar-foreground': '',
      '--sidebar-border': '',
    }
  }

  const base = rgbToHsl(rgb)
  const isLightBackground = relativeLuminance(rgb) >= 0.42
  const surfaceSat = clamp(base.s * 0.32, 0.02, 0.18)
  const card = {
    h: base.h,
    s: surfaceSat,
    l: clamp(base.l + (isLightBackground ? 0.045 : 0.055), 0, 0.985),
  }
  const secondary = {
    h: base.h,
    s: clamp(surfaceSat * 1.1, 0.02, 0.2),
    l: clamp(base.l + (isLightBackground ? -0.03 : 0.085), 0.06, 0.95),
  }
  const muted = {
    h: base.h,
    s: clamp(surfaceSat * 1.2, 0.02, 0.22),
    l: clamp(base.l + (isLightBackground ? -0.045 : 0.11), 0.08, 0.94),
  }
  const border = {
    h: base.h,
    s: clamp(surfaceSat * 0.9, 0.015, 0.16),
    l: clamp(base.l + (isLightBackground ? -0.14 : 0.16), 0.16, 0.82),
  }

  return {
    '--background': color,
    '--foreground': isLightBackground ? 'oklch(0.22 0.01 60)' : 'oklch(0.985 0 0)',
    '--card': toHslCss(card),
    '--card-foreground': isLightBackground ? 'oklch(0.22 0.01 60)' : 'oklch(0.985 0 0)',
    '--popover': toHslCss(card),
    '--popover-foreground': isLightBackground ? 'oklch(0.22 0.01 60)' : 'oklch(0.985 0 0)',
    '--secondary': toHslCss(secondary),
    '--secondary-foreground': isLightBackground ? 'oklch(0.32 0.01 60)' : 'oklch(0.985 0 0)',
    '--muted': toHslCss(muted),
    '--muted-foreground': isLightBackground ? 'oklch(0.52 0.015 60)' : 'oklch(0.74 0.01 260)',
    '--border': toHslAlphaCss(border, isLightBackground ? 0.5 : 0.36),
    '--input': toHslAlphaCss(border, isLightBackground ? 0.5 : 0.36),
    '--sidebar': toHslCss(card),
    '--sidebar-foreground': isLightBackground ? 'oklch(0.22 0.01 60)' : 'oklch(0.985 0 0)',
    '--sidebar-border': toHslAlphaCss(border, isLightBackground ? 0.52 : 0.38),
  }
}

export function buildAdminAppearanceVars(input: {
  resolvedTheme: ResolvedTheme
  themeColor?: string | null
  backgroundColor?: string | null
}): Record<string, string> {
  const vars: Record<string, string> = {}

  if (input.backgroundColor) {
    Object.assign(vars, buildAdminBackgroundVars(input.backgroundColor))
  }

  if (input.themeColor) {
    Object.assign(vars, buildAdminThemeVars(input.themeColor, input.resolvedTheme))
  }

  return vars
}

export function clearAdminThemeVars(target: HTMLElement = document.documentElement) {
  for (const variable of ADMIN_THEME_VAR_NAMES) {
    target.style.removeProperty(variable)
  }
}

export function clearAdminBackgroundVars(target: HTMLElement = document.documentElement) {
  for (const variable of ADMIN_BACKGROUND_VAR_NAMES) {
    target.style.removeProperty(variable)
  }
}
