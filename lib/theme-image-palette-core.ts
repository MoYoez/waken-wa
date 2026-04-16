import type { ColorlipColor, ColorlipPalette } from 'colorlip'

import type { ThemeCustomSurfaceFields } from '@/types/theme'

export type Rgb = { r: number; g: number; b: number }

export type PaletteStats = {
  average: Rgb
  dominant: Rgb
  accent: Rgb
  dark: Rgb
  light: Rgb
}

export const COLORLIP_EXTRACT_OPTIONS = {
  numColors: 6,
} as const

function clamp8(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}

function toRgbCss(rgb: Rgb): string {
  return `rgb(${clamp8(rgb.r)} ${clamp8(rgb.g)} ${clamp8(rgb.b)})`
}

function toRgbaCss(rgb: Rgb, alpha: number): string {
  return `rgba(${clamp8(rgb.r)}, ${clamp8(rgb.g)}, ${clamp8(rgb.b)}, ${Math.max(0, Math.min(1, alpha)).toFixed(3)})`
}

function mixRgb(a: Rgb, b: Rgb, weight: number): Rgb {
  const t = Math.max(0, Math.min(1, weight))
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  }
}

export function luminance(rgb: Rgb): number {
  const channel = (value: number) => {
    const n = value / 255
    return n <= 0.03928 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b)
}

function contrastRatio(a: Rgb, b: Rgb): number {
  const l1 = luminance(a)
  const l2 = luminance(b)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

function pickForeground(background: Rgb): Rgb {
  return luminance(background) > 0.42 ? { r: 28, g: 30, b: 36 } : { r: 248, g: 249, b: 251 }
}

type Hsl = { h: number; s: number; l: number }

function rgbToHsl(rgb: Rgb): Hsl {
  const r = rgb.r / 255
  const g = rgb.g / 255
  const b = rgb.b / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  if (d === 0) return { h: 0, s: 0, l }

  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  switch (max) {
    case r:
      h = (g - b) / d + (g < b ? 6 : 0)
      break
    case g:
      h = (b - r) / d + 2
      break
    default:
      h = (r - g) / d + 4
      break
  }
  return { h: h / 6, s, l }
}

function hslToRgb(hsl: Hsl): Rgb {
  const hue2rgb = (p: number, q: number, t: number) => {
    let x = t
    if (x < 0) x += 1
    if (x > 1) x -= 1
    if (x < 1 / 6) return p + (q - p) * 6 * x
    if (x < 1 / 2) return q
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6
    return p
  }

  if (hsl.s === 0) {
    const gray = clamp8(hsl.l * 255)
    return { r: gray, g: gray, b: gray }
  }

  const q = hsl.l < 0.5 ? hsl.l * (1 + hsl.s) : hsl.l + hsl.s - hsl.l * hsl.s
  const p = 2 * hsl.l - q
  return {
    r: clamp8(hue2rgb(p, q, hsl.h + 1 / 3) * 255),
    g: clamp8(hue2rgb(p, q, hsl.h) * 255),
    b: clamp8(hue2rgb(p, q, hsl.h - 1 / 3) * 255),
  }
}

function clampHsl(rgb: Rgb, limits: { minS?: number; maxS?: number; minL?: number; maxL?: number }): Rgb {
  const hsl = rgbToHsl(rgb)
  return hslToRgb({
    h: hsl.h,
    s: Math.max(limits.minS ?? hsl.s, Math.min(limits.maxS ?? hsl.s, hsl.s)),
    l: Math.max(limits.minL ?? hsl.l, Math.min(limits.maxL ?? hsl.l, hsl.l)),
  })
}

function ensureContrast(foreground: Rgb, background: Rgb, minRatio: number): Rgb {
  if (contrastRatio(foreground, background) >= minRatio) return foreground
  return luminance(background) > 0.42 ? { r: 22, g: 24, b: 28 } : { r: 250, g: 251, b: 252 }
}

function toRgb(color: ColorlipColor | null | undefined, fallback: Rgb): Rgb {
  if (!color) return fallback
  return {
    r: color.r,
    g: color.g,
    b: color.b,
  }
}

function dedupeColorCandidates(input: Array<ColorlipColor | null | undefined>): ColorlipColor[] {
  const out: ColorlipColor[] = []
  const seen = new Set<string>()

  for (const item of input) {
    if (!item) continue
    const key = item.hex || `${item.r},${item.g},${item.b}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }

  return out
}

function findExtremeColor(
  colors: ColorlipColor[],
  comparator: (next: number, current: number) => boolean,
  fallback: Rgb,
): Rgb {
  let picked: ColorlipColor | null = null
  let pickedLuminance = 0

  for (const color of colors) {
    const nextLuminance = luminance(color)
    if (!picked || comparator(nextLuminance, pickedLuminance)) {
      picked = color
      pickedLuminance = nextLuminance
    }
  }

  return toRgb(picked, fallback)
}

function buildAverageColor(colors: ColorlipColor[]): Rgb {
  if (colors.length < 1) {
    throw new Error('Image palette unavailable')
  }

  let totalWeight = 0
  let average = { r: 0, g: 0, b: 0 }

  for (const color of colors) {
    const rawWeight = Number.isFinite(color.percentage) ? color.percentage : 0
    const weight = rawWeight > 0 ? rawWeight : 0
    average = {
      r: average.r + color.r * weight,
      g: average.g + color.g * weight,
      b: average.b + color.b * weight,
    }
    totalWeight += weight
  }

  if (totalWeight <= 0) {
    for (const color of colors) {
      average = {
        r: average.r + color.r,
        g: average.g + color.g,
        b: average.b + color.b,
      }
    }
    totalWeight = colors.length
  }

  return {
    r: average.r / totalWeight,
    g: average.g / totalWeight,
    b: average.b / totalWeight,
  }
}

export function buildThemePaletteStats(
  colors: ColorlipColor[],
  palette: ColorlipPalette,
): PaletteStats {
  const candidates = dedupeColorCandidates([
    palette.dominant,
    palette.accent,
    ...palette.swatches,
    ...colors,
  ])

  if (candidates.length < 1) {
    throw new Error('Image palette unavailable')
  }

  return {
    average: buildAverageColor(colors.length > 0 ? colors : candidates),
    dominant: toRgb(palette.dominant ?? candidates[0], { r: 127, g: 127, b: 127 }),
    accent: toRgb(
      palette.accent ?? candidates[1] ?? palette.dominant ?? candidates[0],
      { r: 127, g: 127, b: 127 },
    ),
    dark: findExtremeColor(candidates, (next, current) => next < current, { r: 30, g: 32, b: 38 }),
    light: findExtremeColor(candidates, (next, current) => next > current, { r: 245, g: 245, b: 245 }),
  }
}

export function buildThemeSurfaceFromPalette(
  palette: PaletteStats,
  seedImageUrl: string,
): Partial<ThemeCustomSurfaceFields> {
  const backgroundBase = mixRgb(mixRgb(palette.average, palette.light, 0.8), palette.dominant, 0.16)
  const background = clampHsl(backgroundBase, { maxS: 0.14, minL: 0.9, maxL: 0.97 })
  const foreground = ensureContrast(pickForeground(background), background, 9)
  const cardBase = mixRgb(background, foreground, luminance(background) > 0.42 ? 0.04 : 0.1)
  const card = clampHsl(cardBase, { maxS: 0.12, minL: 0.86, maxL: 0.98 })
  const secondary = clampHsl(mixRgb(background, palette.light, 0.22), { maxS: 0.12, minL: 0.88, maxL: 0.98 })
  const muted = clampHsl(mixRgb(background, palette.average, 0.08), { maxS: 0.08, minL: 0.87, maxL: 0.95 })
  const mutedForeground = ensureContrast(mixRgb(foreground, background, 0.22), muted, 4.5)
  const border = clampHsl(mixRgb(background, palette.dark, 0.16), { maxS: 0.08, minL: 0.75, maxL: 0.88 })
  const primaryBase = clampHsl(mixRgb(palette.accent, palette.dominant, 0.14), { maxS: 0.5, minL: 0.38, maxL: 0.58 })
  const primary = ensureContrast(primaryBase, background, 3.2)
  const accent = clampHsl(mixRgb(primary, background, 0.18), { maxS: 0.28, minL: 0.55, maxL: 0.82 })
  const online = clampHsl(mixRgb(primary, { r: 76, g: 214, b: 152 }, 0.52), { maxS: 0.5, minL: 0.42, maxL: 0.58 })

  return {
    background: toRgbCss(background),
    foreground: toRgbCss(foreground),
    card: toRgbaCss(card, 0.82),
    border: toRgbCss(border),
    secondary: toRgbCss(secondary),
    muted: toRgbCss(muted),
    mutedForeground: toRgbCss(mutedForeground),
    primary: toRgbCss(primary),
    accent: toRgbCss(accent),
    online: toRgbCss(online),
    animatedBgTint1: toRgbaCss(primary, 0.12),
    animatedBgTint2: toRgbaCss(accent, 0.1),
    animatedBgTint3: toRgbaCss(secondary, 0.08),
    floatingOrbColor1: toRgbaCss(primary, 0.14),
    floatingOrbColor2: toRgbaCss(accent, 0.12),
    floatingOrbColor3: toRgbaCss(secondary, 0.1),
    homeCardOverlay: toRgbaCss(foreground, luminance(background) > 0.42 ? 0.06 : 0.14),
    homeCardOverlayDark: toRgbaCss(foreground, luminance(background) > 0.42 ? 0.1 : 0.18),
    homeCardInsetHighlight: toRgbaCss(palette.light, luminance(background) > 0.42 ? 0.24 : 0.12),
    paletteSeedImageUrl: seedImageUrl,
    paletteMode: 'applyFromCurrent',
  }
}
