import {
  DEFAULT_THEME,
  THEME_COOKIE_NAME,
  THEME_STORAGE_KEY,
  type ThemeMode,
} from '@/lib/theme'

type ThemeBootstrapPayload = {
  cookieName: string
  fallbackTheme: ThemeMode
  storageKey: string
}

const DEFAULT_THEME_BOOTSTRAP_PAYLOAD: ThemeBootstrapPayload = {
  cookieName: THEME_COOKIE_NAME,
  fallbackTheme: DEFAULT_THEME,
  storageKey: THEME_STORAGE_KEY,
}

function serializeThemeBootstrapPayload(payload: ThemeBootstrapPayload): string {
  return JSON.stringify(payload).replace(/</g, '\\u003c')
}

export function buildThemeBootstrapScript(
  payload: ThemeBootstrapPayload = DEFAULT_THEME_BOOTSTRAP_PAYLOAD,
): string {
  return `
;(() => {
  const config = ${serializeThemeBootstrapPayload(payload)}
  const root = document.documentElement

  const readCookieTheme = () => {
    const cookieItem = document.cookie
      .split(';')
      .map((item) => item.trim())
      .find((item) => item.startsWith(config.cookieName + '='))
    return cookieItem ? cookieItem.slice(config.cookieName.length + 1) : ''
  }

  let theme = config.fallbackTheme
  try {
    theme = localStorage.getItem(config.storageKey) || readCookieTheme() || config.fallbackTheme
  } catch {
    theme = readCookieTheme() || config.fallbackTheme
  }

  const resolvedTheme =
    theme === 'dark'
      ? 'dark'
      : theme === 'light'
        ? 'light'
        : window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'

  root.classList.toggle('dark', resolvedTheme === 'dark')
  root.style.colorScheme = resolvedTheme
})()
`.trim()
}
