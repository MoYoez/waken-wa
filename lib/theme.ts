export type ThemeMode = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_COOKIE_NAME = 'theme'
export const THEME_STORAGE_KEY = 'theme'
export const DEFAULT_THEME: ThemeMode = 'system'

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system'
}

export function isResolvedTheme(value: unknown): value is ResolvedTheme {
  return value === 'light' || value === 'dark'
}

export function normalizeThemeMode(
  value: unknown,
  fallback: ThemeMode = DEFAULT_THEME,
): ThemeMode {
  return isThemeMode(value) ? value : fallback
}
