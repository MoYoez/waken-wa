'use client'

import * as React from 'react'

import {
  DEFAULT_THEME,
  normalizeThemeMode,
  type ResolvedTheme,
  THEME_COOKIE_NAME,
  THEME_STORAGE_KEY,
  type ThemeMode,
} from '@/lib/theme'

type ThemeAttribute = 'class' | `data-${string}`

export type ThemeProviderProps = {
  children: React.ReactNode
  attribute?: ThemeAttribute | ThemeAttribute[]
  defaultTheme?: ThemeMode
  disableTransitionOnChange?: boolean
  enableColorScheme?: boolean
  enableSystem?: boolean
  forcedTheme?: ThemeMode
  storageKey?: string
  themes?: ResolvedTheme[]
  value?: Partial<Record<ResolvedTheme, string>>
}

type ThemeContextValue = {
  forcedTheme?: ThemeMode
  resolvedTheme?: ResolvedTheme
  setTheme: (theme: ThemeMode | ((theme: ThemeMode) => ThemeMode)) => void
  systemTheme?: ResolvedTheme
  theme: ThemeMode
  themes: ThemeMode[]
}

const DEFAULT_RESOLVED_THEME: ResolvedTheme = 'light'
const DEFAULT_THEME_CONTEXT: ThemeContextValue = {
  setTheme: () => undefined,
  theme: DEFAULT_THEME,
  themes: ['light', 'dark', 'system'],
}

const ThemeContext = React.createContext<ThemeContextValue>(DEFAULT_THEME_CONTEXT)

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return DEFAULT_RESOLVED_THEME
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function readStoredTheme(storageKey: string, fallback: ThemeMode): ThemeMode {
  if (typeof window === 'undefined') return fallback

  try {
    return normalizeThemeMode(window.localStorage.getItem(storageKey), fallback)
  } catch {
    return fallback
  }
}

function writeThemeCookie(theme: ThemeMode) {
  if (typeof document === 'undefined') return
  document.cookie = `${THEME_COOKIE_NAME}=${theme}; path=/; max-age=31536000; samesite=lax`
}

function disableTransitionsTemporarily() {
  if (typeof document === 'undefined') return () => undefined

  const style = document.createElement('style')
  style.appendChild(
    document.createTextNode(
      '*,*::before,*::after{-webkit-transition:none!important;-moz-transition:none!important;-o-transition:none!important;-ms-transition:none!important;transition:none!important}',
    ),
  )
  document.head.appendChild(style)

  return () => {
    window.getComputedStyle(document.body)
    window.setTimeout(() => {
      document.head.removeChild(style)
    }, 1)
  }
}

function applyThemeToRoot({
  attribute,
  enableColorScheme,
  resolvedTheme,
  themes,
  value,
}: {
  attribute: ThemeAttribute | ThemeAttribute[]
  enableColorScheme: boolean
  resolvedTheme: ResolvedTheme
  themes: ResolvedTheme[]
  value?: Partial<Record<ResolvedTheme, string>>
}) {
  if (typeof document === 'undefined') return

  const root = document.documentElement
  const attributes = Array.isArray(attribute) ? attribute : [attribute]
  const themeClassNames = value ? Object.values(value).filter(Boolean) : themes
  const nextValue = value?.[resolvedTheme] ?? resolvedTheme

  for (const currentAttribute of attributes) {
    if (currentAttribute === 'class') {
      root.classList.remove(...themeClassNames)
      root.classList.add(nextValue)
      continue
    }

    root.setAttribute(currentAttribute, nextValue)
  }

  if (enableColorScheme) {
    root.style.colorScheme = resolvedTheme
  }
}

export function ThemeProvider({
  attribute = 'class',
  children,
  defaultTheme = DEFAULT_THEME,
  disableTransitionOnChange = false,
  enableColorScheme = true,
  enableSystem = false,
  forcedTheme,
  storageKey = THEME_STORAGE_KEY,
  themes = ['light', 'dark'],
  value,
}: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<ThemeMode>(() =>
    typeof window === 'undefined' ? defaultTheme : readStoredTheme(storageKey, defaultTheme),
  )
  const [systemTheme, setSystemTheme] = React.useState<ResolvedTheme>(() => getSystemTheme())

  React.useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      setSystemTheme(mediaQuery.matches ? 'dark' : 'light')
    }

    handleChange()
    mediaQuery.addEventListener('change', handleChange)
    return () => {
      mediaQuery.removeEventListener('change', handleChange)
    }
  }, [])

  React.useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== storageKey) return
      setThemeState(normalizeThemeMode(event.newValue, defaultTheme))
    }

    window.addEventListener('storage', handleStorage)
    return () => {
      window.removeEventListener('storage', handleStorage)
    }
  }, [defaultTheme, storageKey])

  const resolvedTheme: ResolvedTheme = React.useMemo(() => {
    const activeTheme = forcedTheme ?? theme
    if (activeTheme === 'system') return systemTheme
    return activeTheme
  }, [forcedTheme, systemTheme, theme])

  React.useEffect(() => {
    const cleanup = disableTransitionOnChange ? disableTransitionsTemporarily() : undefined
    applyThemeToRoot({
      attribute,
      enableColorScheme,
      resolvedTheme,
      themes,
      value,
    })
    cleanup?.()
  }, [attribute, disableTransitionOnChange, enableColorScheme, resolvedTheme, themes, value])

  const setTheme = React.useCallback(
    (nextTheme: ThemeMode | ((currentTheme: ThemeMode) => ThemeMode)) => {
      setThemeState((currentTheme) => {
        const resolvedNextTheme =
          typeof nextTheme === 'function' ? nextTheme(currentTheme) : nextTheme
        const normalizedTheme = normalizeThemeMode(resolvedNextTheme, defaultTheme)

        try {
          window.localStorage.setItem(storageKey, normalizedTheme)
        } catch {
          // Ignore write failures in restricted contexts.
        }

        writeThemeCookie(normalizedTheme)
        return normalizedTheme
      })
    },
    [defaultTheme, storageKey],
  )

  const contextValue = React.useMemo<ThemeContextValue>(
    () => ({
      forcedTheme,
      resolvedTheme,
      setTheme,
      systemTheme: enableSystem ? systemTheme : undefined,
      theme: forcedTheme ?? theme,
      themes: enableSystem ? [...themes, 'system'] : themes,
    }),
    [enableSystem, forcedTheme, resolvedTheme, setTheme, systemTheme, theme, themes],
  )

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return React.useContext(ThemeContext)
}
