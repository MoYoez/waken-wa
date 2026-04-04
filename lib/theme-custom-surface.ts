import type {
  ThemeBackgroundImageMode,
  ThemeCustomSurfaceFields,
  ThemePaletteLiveScope,
  ThemePaletteMode,
} from '@/types/theme'

export type { ThemeCustomSurfaceFields } from '@/types/theme'

/** Custom surface preset: CSS vars + sanitized user fragments. */
const MAX_SHORT = 2400
const MAX_ANIMATED = 12000
const MAX_RADIUS = 48
const MAX_URL_INNER = 2048
const MAX_IMAGE_POOL = 24

function normalizeThemeBackgroundImageMode(raw: unknown): ThemeBackgroundImageMode | undefined {
  const mode = String(raw ?? '').trim()
  if (mode === 'randomPool' || mode === 'randomApi') return mode
  if (mode === 'manual') return mode
  return undefined
}

function normalizeThemePaletteMode(raw: unknown): ThemePaletteMode | undefined {
  const mode = String(raw ?? '').trim()
  if (mode === 'applyFromCurrent' || mode === 'liveFromImage') return mode
  if (mode === 'manual') return mode
  return undefined
}

function normalizeThemePaletteLiveScope(raw: unknown): ThemePaletteLiveScope | undefined {
  return String(raw ?? '').trim() === 'randomOnly' ? 'randomOnly' : undefined
}

function sanitizeThemeImageSource(input: unknown): string {
  const s = String(input ?? '').trim()
  if (!s) return ''
  return isSafeCssUrl(s) ? s : ''
}

function sanitizeThemeImagePool(input: unknown): string[] | undefined {
  if (!Array.isArray(input)) return undefined
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of input) {
    const value = sanitizeThemeImageSource(item)
    if (!value || seen.has(value)) continue
    seen.add(value)
    out.push(value)
    if (out.length >= MAX_IMAGE_POOL) break
  }
  return out
}

export function resolveThemeImageRuntimeUrl(input: unknown): string {
  const clean = sanitizeThemeImageSource(input)
  if (!clean) return ''
  if (/^https?:\/\//i.test(clean)) {
    return `/api/theme/image?url=${encodeURIComponent(clean)}`
  }
  return clean
}

/**
 * True if inner part of css url(...) is allowed (https/http, same-origin paths, image data URLs).
 * Note: url(...) must not contain unencoded ")" — very long or exotic data: URLs may not parse.
 */
export function isSafeCssUrl(inner: string): boolean {
  const t = inner.trim().replace(/^["']|["']$/g, '').trim()
  if (!t || t.length > MAX_URL_INNER) return false
  const head = t.slice(0, 80).toLowerCase()
  if (head.includes('javascript:') || head.includes('vbscript:')) return false

  if (head.startsWith('data:')) {
    if (
      /^data:image\/(png|jpeg|jpg|gif|webp|avif|bmp);base64,/i.test(t) &&
      /^data:image\/(png|jpeg|jpg|gif|webp|avif|bmp);base64,[a-z0-9+/=\s]+$/i.test(t)
    ) {
      return true
    }
    // Inline SVG: trusted admin context; block obvious script. Note: ")" inside the URL breaks our url() parser — use https or encode.
    if (/^data:image\/svg\+xml/i.test(t)) {
      if (t.length > MAX_URL_INNER) return false
      if (/<script/i.test(t)) return false
      return !t.includes(')')
    }
    return false
  }

  if (/^https:\/\//i.test(t)) return true
  if (/^http:\/\//i.test(t)) return true
  if (t.startsWith('/')) return true
  if (t.startsWith('./') || t.startsWith('../')) return true
  return false
}

/**
 * Replace disallowed url(...) with `none`.
 * Allowed URLs are re-emitted as url("...") so spaces before `)`, quotes in paths, and parser quirks are avoided.
 */
export function sanitizeCssUrls(css: string): string {
  const re = /url\s*\(/gi
  let last = 0
  let out = ''
  let m: RegExpExecArray | null
  while ((m = re.exec(css)) !== null) {
    const start = m.index
    out += css.slice(last, start)
    let j = start + m[0].length
    while (j < css.length && /\s/.test(css[j])) j += 1

    let inner = ''
    const c = css[j]
    if (c === '"' || c === "'") {
      const q = c
      j += 1
      while (j < css.length) {
        if (css[j] === '\\' && j + 1 < css.length) {
          inner += css[j] + css[j + 1]
          j += 2
          continue
        }
        if (css[j] === q) {
          j += 1
          break
        }
        inner += css[j]
        j += 1
      }
    } else {
      while (j < css.length && css[j] !== ')') {
        inner += css[j]
        j += 1
      }
    }
    while (j < css.length && /\s/.test(css[j])) j += 1
    if (css[j] === ')') j += 1

    const stripped = inner.trim().replace(/^["']|["']$/g, '').trim()
    out += !isSafeCssUrl(stripped) ? 'none' : `url(${JSON.stringify(stripped)})`
    last = j
    re.lastIndex = j
  }
  out += css.slice(last)
  return out
}

/** Defaults inspired by soft personal / “paper + warm gradient” landing pages. */
export const THEME_CUSTOM_SURFACE_DEFAULTS: Required<
  Omit<
    ThemeCustomSurfaceFields,
    | 'hideFloatingOrbs'
    | 'transparentAnimatedBg'
    | 'paletteLiveEnabled'
    | 'backgroundImagePool'
  >
> & { hideFloatingOrbs: boolean; paletteLiveEnabled: boolean; backgroundImagePool: string[] } = {
  background: 'oklch(0.97 0.018 85)',
  bodyBackground: '',
  animatedBg: '',
  primary: 'oklch(0.46 0.085 52)',
  secondary: 'oklch(0.935 0.022 80)',
  accent: 'oklch(0.9 0.045 70)',
  online: 'oklch(0.58 0.15 150)',
  foreground: 'oklch(0.28 0.032 55)',
  card: 'oklch(0.995 0.012 85 / 0.78)',
  border: 'oklch(0.88 0.028 72)',
  muted: 'oklch(0.94 0.018 82)',
  mutedForeground: 'oklch(0.5 0.038 58)',
  homeCardOverlay: 'rgba(15, 23, 42, 0.06)',
  homeCardOverlayDark: 'rgba(255, 255, 255, 0.08)',
  homeCardInsetHighlight: 'rgba(255, 255, 255, 0.06)',
  animatedBgTint1: 'rgba(120, 119, 198, 0.1)',
  animatedBgTint2: 'rgba(255, 200, 150, 0.08)',
  animatedBgTint3: 'rgba(150, 200, 255, 0.06)',
  floatingOrbColor1: 'rgba(180, 160, 200, 0.15)',
  floatingOrbColor2: 'rgba(255, 200, 170, 0.12)',
  floatingOrbColor3: 'rgba(170, 200, 220, 0.1)',
  radius: '0.875rem',
  hideFloatingOrbs: true,
  backgroundImageMode: 'manual',
  backgroundImageUrl: '',
  backgroundImagePool: [],
  backgroundRandomApiUrl: '',
  paletteMode: 'manual',
  paletteLiveEnabled: false,
  paletteLiveScope: 'randomOnly',
  paletteSeedImageUrl: '',
}

export function sanitizeThemeCssValue(input: unknown, maxLen: number): string {
  let s = String(input ?? '')
    .trim()
    .slice(0, maxLen)
  s = s
    .replace(/[<>{}]/g, '')
    .replace(/@import/gi, '')
    .replace(/expression\s*\(/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/behavior\s*:/gi, '')
  s = sanitizeCssUrls(s)
  return s
}

function parseThemeCustomSurfaceRaw(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw
  const trimmed = raw.trim()
  if (!trimmed) return null
  try {
    return JSON.parse(trimmed)
  } catch {
    return raw
  }
}

function readBackgroundField(o: Record<string, unknown>): unknown {
  const v =
    o.background ??
    o.backendColor ??
    o.backend_color ??
    o['backend-color'] ??
    o['--backend-color']
  return v
}

/** Normalizes client/API payload for DB and CSS generation. */
export function parseThemeCustomSurface(raw: unknown): ThemeCustomSurfaceFields {
  const parsedRaw = parseThemeCustomSurfaceRaw(raw)
  if (!parsedRaw || typeof parsedRaw !== 'object' || Array.isArray(parsedRaw)) {
    return {}
  }
  const o = parsedRaw as Record<string, unknown>
  return {
    background: sanitizeThemeCssValue(readBackgroundField(o), MAX_SHORT),
    bodyBackground: sanitizeThemeCssValue(o.bodyBackground, MAX_ANIMATED),
    animatedBg: sanitizeThemeCssValue(o.animatedBg, MAX_ANIMATED),
    primary: sanitizeThemeCssValue(o.primary, MAX_SHORT),
    secondary: sanitizeThemeCssValue(o.secondary, MAX_SHORT),
    accent: sanitizeThemeCssValue(o.accent, MAX_SHORT),
    online: sanitizeThemeCssValue(o.online, MAX_SHORT),
    foreground: sanitizeThemeCssValue(o.foreground, MAX_SHORT),
    card: sanitizeThemeCssValue(o.card, MAX_SHORT),
    border: sanitizeThemeCssValue(o.border, MAX_SHORT),
    muted: sanitizeThemeCssValue(o.muted, MAX_SHORT),
    mutedForeground: sanitizeThemeCssValue(o.mutedForeground, MAX_SHORT),
    homeCardOverlay: sanitizeThemeCssValue(o.homeCardOverlay, MAX_SHORT),
    homeCardOverlayDark: sanitizeThemeCssValue(o.homeCardOverlayDark, MAX_SHORT),
    homeCardInsetHighlight: sanitizeThemeCssValue(o.homeCardInsetHighlight, MAX_SHORT),
    animatedBgTint1: sanitizeThemeCssValue(o.animatedBgTint1, MAX_SHORT),
    animatedBgTint2: sanitizeThemeCssValue(o.animatedBgTint2, MAX_SHORT),
    animatedBgTint3: sanitizeThemeCssValue(o.animatedBgTint3, MAX_SHORT),
    floatingOrbColor1: sanitizeThemeCssValue(o.floatingOrbColor1, MAX_SHORT),
    floatingOrbColor2: sanitizeThemeCssValue(o.floatingOrbColor2, MAX_SHORT),
    floatingOrbColor3: sanitizeThemeCssValue(o.floatingOrbColor3, MAX_SHORT),
    radius: sanitizeThemeCssValue(o.radius, MAX_RADIUS),
    hideFloatingOrbs:
      typeof o.hideFloatingOrbs === 'boolean' ? o.hideFloatingOrbs : undefined,
    transparentAnimatedBg:
      typeof o.transparentAnimatedBg === 'boolean'
        ? o.transparentAnimatedBg
        : undefined,
    backgroundImageMode: normalizeThemeBackgroundImageMode(o.backgroundImageMode),
    backgroundImageUrl: sanitizeThemeImageSource(o.backgroundImageUrl),
    backgroundImagePool: sanitizeThemeImagePool(o.backgroundImagePool),
    backgroundRandomApiUrl: sanitizeThemeImageSource(o.backgroundRandomApiUrl),
    paletteMode: normalizeThemePaletteMode(o.paletteMode),
    paletteLiveEnabled:
      typeof o.paletteLiveEnabled === 'boolean' ? o.paletteLiveEnabled : undefined,
    paletteLiveScope: normalizeThemePaletteLiveScope(o.paletteLiveScope),
    paletteSeedImageUrl: sanitizeThemeImageSource(o.paletteSeedImageUrl),
  }
}

function pick(
  parsed: ThemeCustomSurfaceFields,
  key:
    | 'background'
    | 'bodyBackground'
    | 'animatedBg'
    | 'primary'
    | 'secondary'
    | 'accent'
    | 'online'
    | 'foreground'
    | 'card'
    | 'border'
    | 'muted'
    | 'mutedForeground'
    | 'homeCardOverlay'
    | 'homeCardOverlayDark'
    | 'homeCardInsetHighlight'
    | 'animatedBgTint1'
    | 'animatedBgTint2'
    | 'animatedBgTint3'
    | 'floatingOrbColor1'
    | 'floatingOrbColor2'
    | 'floatingOrbColor3'
    | 'radius',
): string {
  const v = parsed[key]
  const s = typeof v === 'string' ? v.trim() : ''
  return s || THEME_CUSTOM_SURFACE_DEFAULTS[key]
}

function resolveHideOrbs(parsed: ThemeCustomSurfaceFields): boolean {
  if (parsed.hideFloatingOrbs !== undefined) {
    return parsed.hideFloatingOrbs
  }
  return THEME_CUSTOM_SURFACE_DEFAULTS.hideFloatingOrbs
}

function resolveTransparentAnimatedBg(parsed: ThemeCustomSurfaceFields): boolean {
  return parsed.transparentAnimatedBg === true
}

export function resolveThemeBackgroundImageMode(parsed: ThemeCustomSurfaceFields): ThemeBackgroundImageMode {
  return parsed.backgroundImageMode ?? THEME_CUSTOM_SURFACE_DEFAULTS.backgroundImageMode
}

export function resolveThemePaletteMode(parsed: ThemeCustomSurfaceFields): ThemePaletteMode {
  return parsed.paletteMode ?? THEME_CUSTOM_SURFACE_DEFAULTS.paletteMode
}

export function resolveThemePaletteLiveScope(parsed: ThemeCustomSurfaceFields): ThemePaletteLiveScope {
  return parsed.paletteLiveScope ?? THEME_CUSTOM_SURFACE_DEFAULTS.paletteLiveScope
}

export function isThemePaletteLiveEnabled(parsed: ThemeCustomSurfaceFields): boolean {
  return parsed.paletteLiveEnabled === true
}

export function resolveThemeImagePool(parsed: ThemeCustomSurfaceFields): string[] {
  return Array.isArray(parsed.backgroundImagePool) ? parsed.backgroundImagePool : []
}

export function buildThemeImageBackgroundCss(url: string): string {
  const runtimeUrl = resolveThemeImageRuntimeUrl(url)
  if (!runtimeUrl) return ''
  return `url(${JSON.stringify(runtimeUrl)}) center / cover no-repeat`
}

function mixColorCss(base: string, target: 'black' | 'white', percent: number): string {
  const safePercent = Math.max(0, Math.min(100, Math.round(percent)))
  const rest = 100 - safePercent
  return `color-mix(in srgb, ${base} ${safePercent}%, ${target} ${rest}%)`
}

function alphaColorCss(base: string, alpha: number): string {
  const safe = Math.max(0, Math.min(1, alpha))
  return `color-mix(in srgb, ${base} ${Math.round(safe * 100)}%, transparent)`
}

export function resolveThemeManualBodyBackground(parsed: ThemeCustomSurfaceFields): string {
  const explicit = pick(parsed, 'bodyBackground').trim()
  if (explicit) return explicit

  if (resolveThemeBackgroundImageMode(parsed) === 'manual') {
    return buildThemeImageBackgroundCss(parsed.backgroundImageUrl ?? '')
  }
  return ''
}

/** Emits CSS for preset `customSurface`. */
export function buildCustomSurfaceCss(themeCustomSurface: unknown): string {
  const parsed = parseThemeCustomSurface(themeCustomSurface)
  const background = pick(parsed, 'background')
  const bodyBackground = resolveThemeManualBodyBackground(parsed)
  const animatedBgCustom = pick(parsed, 'animatedBg')
  const animatedBgTint1 = pick(parsed, 'animatedBgTint1')
  const animatedBgTint2 = pick(parsed, 'animatedBgTint2')
  const animatedBgTint3 = pick(parsed, 'animatedBgTint3')
  const animatedBgDefault = `radial-gradient(ellipse 80% 50% at 50% -20%, ${animatedBgTint1}, transparent), radial-gradient(ellipse 60% 40% at 100% 100%, ${animatedBgTint2}, transparent), radial-gradient(ellipse 50% 30% at 0% 80%, ${animatedBgTint3}, transparent)`
  const animatedBg = animatedBgCustom.trim() || animatedBgDefault
  const transparentAnimatedBg = resolveTransparentAnimatedBg(parsed)
  const animatedBgPaint = transparentAnimatedBg ? 'transparent' : animatedBg
  const primary = pick(parsed, 'primary')
  const secondary = pick(parsed, 'secondary')
  const accent = pick(parsed, 'accent')
  const online = pick(parsed, 'online')
  const foreground = pick(parsed, 'foreground')
  const card = pick(parsed, 'card')
  const border = pick(parsed, 'border')
  const muted = pick(parsed, 'muted')
  const mutedForeground = pick(parsed, 'mutedForeground')
  const homeCardOverlay = pick(parsed, 'homeCardOverlay')
  const homeCardOverlayDark = pick(parsed, 'homeCardOverlayDark')
  const homeCardInsetHighlight = pick(parsed, 'homeCardInsetHighlight')
  const floatingOrbColor1 = pick(parsed, 'floatingOrbColor1')
  const floatingOrbColor2 = pick(parsed, 'floatingOrbColor2')
  const floatingOrbColor3 = pick(parsed, 'floatingOrbColor3')
  const radius = pick(parsed, 'radius')
  const hideFloatingOrbs = resolveHideOrbs(parsed)

  const hideOrbsCss = hideFloatingOrbs
    ? '.floating-orb{display:none!important;}'
    : ''

  const bodyBackgroundTrimmed = bodyBackground.trim()
  // After `background` shorthand, set longhands so images scale like object-fit: cover (fill viewport, crop if aspect mismatch).
  const bodyBackgroundCss = bodyBackgroundTrimmed
    ? `body {\n  background: ${bodyBackgroundTrimmed};\n  background-position: 50% 50%;\n  background-size: cover;\n  background-repeat: no-repeat;\n}\n`
    : ''

  return `
/* customSurface: ensure these rules win over globals.css :root (same specificity, later in DOM) */
:root {
  --radius: ${radius};
  /* Page surface color only (Tailwind bg-background → background-color). */
  --background: ${background};
  --color-background: ${background};
  --foreground: ${foreground};
  --color-foreground: ${foreground};
  --card: ${card};
  --card-foreground: ${foreground};
  --popover: ${card};
  --popover-foreground: ${foreground};
  --primary: ${primary};
  --primary-foreground: oklch(0.99 0.01 85);
  --secondary: ${secondary};
  --secondary-foreground: ${foreground};
  --muted: ${muted};
  --muted-foreground: ${mutedForeground};
  --accent: ${accent};
  --accent-foreground: ${foreground};
  --border: ${border};
  --input: ${border};
  --ring: ${primary};
  --online: ${online};
  --home-card-overlay: ${homeCardOverlay};
  --home-card-overlay-dark: ${homeCardOverlayDark};
  --home-card-inset-highlight: ${homeCardInsetHighlight};
}
.dark {
  --radius: ${radius};
  --background: ${mixColorCss(background, 'black', 10)};
  --color-background: ${mixColorCss(background, 'black', 10)};
  --foreground: oklch(0.96 0.01 260);
  --color-foreground: oklch(0.96 0.01 260);
  --card: ${mixColorCss(background, 'black', 18)};
  --card-foreground: oklch(0.96 0.01 260);
  --popover: ${mixColorCss(background, 'black', 20)};
  --popover-foreground: oklch(0.96 0.01 260);
  --primary: ${mixColorCss(primary, 'white', 58)};
  --primary-foreground: oklch(0.18 0.01 260);
  --secondary: ${mixColorCss(background, 'white', 18)};
  --secondary-foreground: oklch(0.96 0.01 260);
  --muted: ${mixColorCss(background, 'white', 14)};
  --muted-foreground: oklch(0.82 0.01 260);
  --accent: ${mixColorCss(accent, 'white', 34)};
  --accent-foreground: oklch(0.96 0.01 260);
  --border: ${alphaColorCss('oklch(0.96 0.01 260)', 0.16)};
  --input: ${alphaColorCss('oklch(0.96 0.01 260)', 0.16)};
  --ring: ${mixColorCss(primary, 'white', 62)};
  --online: ${mixColorCss(online, 'white', 56)};
  --home-card-overlay: rgba(255, 255, 255, 0.06);
  --home-card-overlay-dark: rgba(255, 255, 255, 0.1);
  --home-card-inset-highlight: rgba(255, 255, 255, 0.12);
}
${bodyBackgroundCss}
.animated-bg {
  background: ${animatedBgPaint};
  animation: none;
}
.dark .animated-bg {
  filter: brightness(0.42) saturate(0.72);
}
.floating-orb-1 {
  background: ${floatingOrbColor1};
}
.floating-orb-2 {
  background: ${floatingOrbColor2};
}
.floating-orb-3 {
  background: ${floatingOrbColor3};
}
${hideOrbsCss}
`.trim()
}
