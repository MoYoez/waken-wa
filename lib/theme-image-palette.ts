import { resolveThemeImageRuntimeUrl } from '@/lib/theme-custom-surface'
import type { ThemeCustomSurfaceFields } from '@/types/theme'

type Rgb = { r: number; g: number; b: number }

type PaletteStats = {
  average: Rgb
  accent: Rgb
  dark: Rgb
  light: Rgb
}

type Hsl = { h: number; s: number; l: number }

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

function luminance(rgb: Rgb): number {
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

function saturation(rgb: Rgb): number {
  const max = Math.max(rgb.r, rgb.g, rgb.b)
  const min = Math.min(rgb.r, rgb.g, rgb.b)
  if (max === 0) return 0
  return (max - min) / max
}

function scoreAccent(rgb: Rgb): number {
  const sat = saturation(rgb)
  const lum = luminance(rgb)
  const midBias = 1 - Math.abs(lum - 0.52) * 1.4
  return sat * 1.2 + Math.max(0, midBias)
}

function pickForeground(background: Rgb): Rgb {
  return luminance(background) > 0.42 ? { r: 28, g: 30, b: 36 } : { r: 248, g: 249, b: 251 }
}

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

export function normalizeThemePaletteImageSource(input: string): string {
  const direct = String(input ?? '').trim()
  if (/^blob:/i.test(direct)) {
    return direct
  }
  return resolveThemeImageRuntimeUrl(input)
}

export async function loadPaletteImage(src: string): Promise<HTMLImageElement> {
  const clean = normalizeThemePaletteImageSource(src)
  if (!clean) {
    throw new Error('Missing image source')
  }

  const image = new Image()
  image.decoding = 'async'
  if (/^(https?:)?\/\//i.test(clean)) {
    image.crossOrigin = 'anonymous'
  }

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('Image load failed'))
    image.src = clean
  })

  return image
}

export function analyzePaletteImage(image: HTMLImageElement): PaletteStats {
  const maxSize = 96
  const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight))
  const width = Math.max(1, Math.round(image.naturalWidth * scale))
  const height = Math.max(1, Math.round(image.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) {
    throw new Error('Canvas unavailable')
  }

  canvas.width = width
  canvas.height = height
  ctx.drawImage(image, 0, 0, width, height)

  const data = ctx.getImageData(0, 0, width, height).data
  let count = 0
  const average = { r: 0, g: 0, b: 0 }
  let accent = { r: 127, g: 127, b: 127 }
  let accentScore = -1
  let dark = { r: 30, g: 32, b: 38 }
  let darkLum = Number.POSITIVE_INFINITY
  let light = { r: 245, g: 245, b: 245 }
  let lightLum = Number.NEGATIVE_INFINITY

  for (let index = 0; index < data.length; index += 16) {
    const alpha = data[index + 3] / 255
    if (alpha < 0.08) continue
    const rgb = { r: data[index], g: data[index + 1], b: data[index + 2] }
    average.r += rgb.r
    average.g += rgb.g
    average.b += rgb.b
    count += 1

    const lum = luminance(rgb)
    const currentAccentScore = scoreAccent(rgb)
    if (currentAccentScore > accentScore) {
      accent = rgb
      accentScore = currentAccentScore
    }
    if (lum < darkLum) {
      dark = rgb
      darkLum = lum
    }
    if (lum > lightLum) {
      light = rgb
      lightLum = lum
    }
  }

  if (count < 1) {
    throw new Error('Image pixels unavailable')
  }

  return {
    average: {
      r: average.r / count,
      g: average.g / count,
      b: average.b / count,
    },
    accent,
    dark,
    light,
  }
}

export async function extractImagePalette(src: string): Promise<PaletteStats> {
  const image = await loadPaletteImage(src)
  return analyzePaletteImage(image)
}

export function buildThemeSurfaceFromPalette(
  palette: PaletteStats,
  seedImageUrl: string,
): Partial<ThemeCustomSurfaceFields> {
  const backgroundBase = mixRgb(palette.average, palette.light, 0.86)
  const background = clampHsl(backgroundBase, { maxS: 0.14, minL: 0.9, maxL: 0.97 })
  const foreground = ensureContrast(pickForeground(background), background, 9)
  const cardBase = mixRgb(background, foreground, luminance(background) > 0.42 ? 0.04 : 0.1)
  const card = clampHsl(cardBase, { maxS: 0.12, minL: 0.86, maxL: 0.98 })
  const secondary = clampHsl(mixRgb(background, palette.light, 0.22), { maxS: 0.12, minL: 0.88, maxL: 0.98 })
  const muted = clampHsl(mixRgb(background, palette.average, 0.08), { maxS: 0.08, minL: 0.87, maxL: 0.95 })
  const mutedForeground = ensureContrast(mixRgb(foreground, background, 0.22), muted, 4.5)
  const border = clampHsl(mixRgb(background, palette.dark, 0.16), { maxS: 0.08, minL: 0.75, maxL: 0.88 })
  const primaryBase = clampHsl(palette.accent, { maxS: 0.5, minL: 0.38, maxL: 0.58 })
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

export async function extractThemeSurfaceFromImage(
  src: string,
): Promise<Partial<ThemeCustomSurfaceFields>> {
  const clean = normalizeThemePaletteImageSource(src)
  const palette = await extractImagePalette(clean)
  return buildThemeSurfaceFromPalette(palette, clean)
}

export function extractThemeSurfaceFromLoadedImage(
  image: HTMLImageElement,
  seedImageUrl: string,
): Partial<ThemeCustomSurfaceFields> {
  const clean = normalizeThemePaletteImageSource(seedImageUrl)
  const palette = analyzePaletteImage(image)
  return buildThemeSurfaceFromPalette(palette, clean)
}
