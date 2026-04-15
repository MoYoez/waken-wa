export const PUBLIC_PAGE_FONT_STORAGE_KEY = 'public-page-font-preference'
export const PUBLIC_PAGE_FONT_COOKIE_NAME = 'public_page_font_preference'
export const PUBLIC_PAGE_FONT_STYLE_ELEMENT_ID = 'public-page-font-preference-style'
export const PUBLIC_PAGE_FONT_STYLESHEET_ELEMENT_ID = 'public-page-font-preference-link'

export type PublicPageFontSource = 'default' | 'preset' | 'google' | 'custom'

export type PublicPageFontPresetId = 'notoSansSc' | 'ubuntu' | 'notoSerifSc'

export type PublicPageFontPreference = {
  source: PublicPageFontSource
  presetId?: PublicPageFontPresetId
  googleFamily?: string
  customFamily?: string
  customUrl?: string
}

export type PublicPageFontPreset = {
  family: string
  id: PublicPageFontPresetId
}

export type PublicPageFontOptionMode = 'default' | 'google' | 'custom'

export type PublicPageFontOption = {
  family: string
  label: string
  mode: PublicPageFontOptionMode
  url?: string
}

export const PUBLIC_PAGE_FONT_PRESETS: PublicPageFontPreset[] = [
  {
    id: 'notoSansSc',
    family: 'Noto Sans SC',
  },
  {
    id: 'ubuntu',
    family: 'Ubuntu',
  },
  {
    id: 'notoSerifSc',
    family: 'Noto Serif SC',
  },
]

export const DEFAULT_PUBLIC_PAGE_CONTROL_FONT_OPTIONS: PublicPageFontOption[] = [
  {
    mode: 'default',
    label: 'Default font',
    family: '',
  },
  {
    mode: 'google',
    label: 'Serif font',
    family: 'Noto Serif SC',
  },
]

const DEFAULT_PREFERENCE: PublicPageFontPreference = {
  source: 'default',
}

const VALID_SOURCES = new Set<PublicPageFontSource>(['default', 'preset', 'google', 'custom'])
const VALID_PRESET_IDS = new Set<PublicPageFontPresetId>(PUBLIC_PAGE_FONT_PRESETS.map((item) => item.id))
const VALID_OPTION_MODES = new Set<PublicPageFontOptionMode>(['default', 'google', 'custom'])
const MAX_FAMILY_LEN = 100
const MAX_LABEL_LEN = 60
const MAX_URL_LEN = 2000
const MAX_OPTIONS = 2

function stripUnsafeCharacters(input: unknown) {
  return String(input ?? '')
    .replace(/[\u0000-\u001f\u007f<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizePublicPageFontFamily(input: unknown): string {
  return stripUnsafeCharacters(input).slice(0, MAX_FAMILY_LEN)
}

export function normalizePublicPageFontLabel(input: unknown): string {
  return stripUnsafeCharacters(input).slice(0, MAX_LABEL_LEN)
}

export function normalizePublicPageFontUrl(input: unknown): string {
  return String(input ?? '').trim().slice(0, MAX_URL_LEN)
}

export function isAllowedPublicPageFontUrl(input: unknown): boolean {
  const value = normalizePublicPageFontUrl(input)
  if (!value) return false
  return /^(https?:\/\/|\/|\.{1,2}\/)/i.test(value)
}

function parseJsonLike(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw
  const trimmed = raw.trim()
  if (!trimmed) return null
  try {
    return JSON.parse(trimmed)
  } catch {
    return null
  }
}

export function normalizePublicPageFontPreference(raw: unknown): PublicPageFontPreference {
  const parsed = parseJsonLike(raw)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return DEFAULT_PREFERENCE
  }

  const record = parsed as Record<string, unknown>
  const source = String(record.source ?? '').trim() as PublicPageFontSource

  if (!VALID_SOURCES.has(source)) {
    return DEFAULT_PREFERENCE
  }

  if (source === 'default') {
    return DEFAULT_PREFERENCE
  }

  if (source === 'preset') {
    const presetId = String(record.presetId ?? '').trim() as PublicPageFontPresetId
    if (!VALID_PRESET_IDS.has(presetId)) {
      return DEFAULT_PREFERENCE
    }
    return {
      source,
      presetId,
    }
  }

  if (source === 'google') {
    const googleFamily = normalizePublicPageFontFamily(record.googleFamily)
    if (!googleFamily) {
      return DEFAULT_PREFERENCE
    }
    return {
      source,
      googleFamily,
    }
  }

  const customFamily = normalizePublicPageFontFamily(record.customFamily)
  const customUrl = normalizePublicPageFontUrl(record.customUrl)
  if (!customFamily || !isAllowedPublicPageFontUrl(customUrl)) {
    return DEFAULT_PREFERENCE
  }
  return {
    source: 'custom',
    customFamily,
    customUrl,
  }
}

export function serializePublicPageFontPreference(
  preference: PublicPageFontPreference = DEFAULT_PREFERENCE,
): string {
  return JSON.stringify(normalizePublicPageFontPreference(preference))
}

export function encodePublicPageFontPreferenceCookie(
  preference: PublicPageFontPreference = DEFAULT_PREFERENCE,
): string {
  return encodeURIComponent(serializePublicPageFontPreference(preference))
}

export function parsePublicPageFontCookie(raw: string | null | undefined): PublicPageFontPreference {
  if (!raw) return DEFAULT_PREFERENCE
  try {
    return normalizePublicPageFontPreference(decodeURIComponent(raw))
  } catch {
    return DEFAULT_PREFERENCE
  }
}

export function getPublicPageFontPresetById(id: PublicPageFontPresetId | null | undefined) {
  return PUBLIC_PAGE_FONT_PRESETS.find((item) => item.id === id) ?? null
}

export function buildGoogleFontsStylesheetHref(family: string): string {
  const normalizedFamily = normalizePublicPageFontFamily(family)
  const familyParam = normalizedFamily
    .split(' ')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('+')
  return `https://fonts.loli.net/css2?family=${familyParam}&display=swap`
}

export function normalizePublicPageFontOptions(raw: unknown): PublicPageFontOption[] {
  const parsed = parseJsonLike(raw)
  if (!Array.isArray(parsed)) {
    return []
  }

  const out: PublicPageFontOption[] = []

  for (const item of parsed) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      continue
    }

    const record = item as Record<string, unknown>
    const mode = String(record.mode ?? '').trim() as PublicPageFontOptionMode
    if (!VALID_OPTION_MODES.has(mode)) {
      continue
    }

    const family = normalizePublicPageFontFamily(record.family)
    const url = normalizePublicPageFontUrl(record.url)
    const label =
      normalizePublicPageFontLabel(record.label) ||
      family ||
      (mode === 'default' ? 'Default font' : '')

    if (mode === 'default') {
      out.push({
        mode,
        label: label || 'Default font',
        family: '',
      })
    } else if (mode === 'google') {
      if (!family) continue
      out.push({
        mode,
        label: label || family,
        family,
      })
    } else {
      if (!family || !isAllowedPublicPageFontUrl(url)) continue
      out.push({
        mode,
        label: label || family,
        family,
        url,
      })
    }

    if (out.length >= MAX_OPTIONS) {
      break
    }
  }

  return out
}

export function resolvePublicPageControlFontOptions(
  enabledRaw: unknown,
  raw: unknown,
): PublicPageFontOption[] {
  if (enabledRaw !== true) {
    return DEFAULT_PUBLIC_PAGE_CONTROL_FONT_OPTIONS
  }

  const normalized = normalizePublicPageFontOptions(raw)
  return normalized.length > 0 ? normalized : DEFAULT_PUBLIC_PAGE_CONTROL_FONT_OPTIONS
}

export function buildPublicPageFontPreferenceFromOption(
  option: PublicPageFontOption,
): PublicPageFontPreference {
  if (option.mode === 'default') {
    return DEFAULT_PREFERENCE
  }

  if (option.mode === 'google') {
    return {
      source: 'google',
      googleFamily: option.family,
    }
  }

  return {
    source: 'custom',
    customFamily: option.family,
    customUrl: option.url ?? '',
  }
}

export function matchesPublicPageFontOption(
  preferenceRaw: unknown,
  option: PublicPageFontOption,
): boolean {
  const preference = normalizePublicPageFontPreference(preferenceRaw)
  if (option.mode === 'default') {
    return preference.source === 'default'
  }
  if (option.mode === 'google') {
    return preference.source === 'google' && preference.googleFamily === option.family
  }
  return (
    preference.source === 'custom' &&
    preference.customFamily === option.family &&
    preference.customUrl === option.url
  )
}

export function isPublicPageFontPreferenceAvailable(
  preferenceRaw: unknown,
  optionsRaw: unknown,
): boolean {
  const options = Array.isArray(optionsRaw) ? optionsRaw : []
  if (options.length === 0) {
    return normalizePublicPageFontPreference(preferenceRaw).source === 'default'
  }

  return options.some((option) =>
    matchesPublicPageFontOption(preferenceRaw, option as PublicPageFontOption),
  )
}

export function coercePublicPageFontPreferenceToOptions(
  preferenceRaw: unknown,
  optionsRaw: unknown,
): PublicPageFontPreference {
  const preference = normalizePublicPageFontPreference(preferenceRaw)
  return isPublicPageFontPreferenceAvailable(preference, optionsRaw)
    ? preference
    : DEFAULT_PREFERENCE
}

export function resolvePublicPageFontDisplayFamily(
  preference: PublicPageFontPreference,
): string | null {
  if (preference.source === 'preset') {
    return getPublicPageFontPresetById(preference.presetId)?.family ?? null
  }
  if (preference.source === 'google') {
    return preference.googleFamily ?? null
  }
  if (preference.source === 'custom') {
    return preference.customFamily ?? null
  }
  return null
}

export function buildPublicPageFontRuntime(preferenceRaw: unknown): {
  cssText: string
  displayFamily: string | null
  stylesheetHref: string | null
} {
  const preference = normalizePublicPageFontPreference(preferenceRaw)
  const displayFamily = resolvePublicPageFontDisplayFamily(preference)
  const fontFamilyCssValue = displayFamily
    ? `${JSON.stringify(displayFamily)}, var(--font-sans-default)`
    : 'var(--font-sans-default)'

  const cssParts: string[] = []

  if (
    preference.source === 'custom' &&
    preference.customFamily &&
    preference.customUrl &&
    isAllowedPublicPageFontUrl(preference.customUrl)
  ) {
    cssParts.push(
      `@font-face {
  font-family: ${JSON.stringify(preference.customFamily)};
  src: url(${JSON.stringify(preference.customUrl)});
  font-display: swap;
}`,
    )
  }

  cssParts.push(`:root {
  --public-page-font-family: ${fontFamilyCssValue};
}`)

  let stylesheetHref: string | null = null
  if (preference.source === 'preset') {
    const preset = getPublicPageFontPresetById(preference.presetId)
    if (preset && preset.id === 'notoSerifSc') {
      stylesheetHref = buildGoogleFontsStylesheetHref(preset.family)
    }
  } else if (preference.source === 'google' && preference.googleFamily) {
    stylesheetHref = buildGoogleFontsStylesheetHref(preference.googleFamily)
  }

  return {
    cssText: cssParts.join('\n\n'),
    displayFamily,
    stylesheetHref,
  }
}
