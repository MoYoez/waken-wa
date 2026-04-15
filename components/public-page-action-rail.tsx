'use client'

import { ArrowUp, Laptop, Moon, Pilcrow, Settings2, Sun, Type } from 'lucide-react'
import { useT } from 'next-i18next/client'
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'

import { useTheme } from '@/components/theme-provider'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  buildPublicPageFontPreferenceFromOption,
  buildPublicPageFontRuntime,
  coercePublicPageFontPreferenceToOptions,
  encodePublicPageFontPreferenceCookie,
  matchesPublicPageFontOption,
  normalizePublicPageFontPreference,
  parsePublicPageFontCookie,
  PUBLIC_PAGE_FONT_COOKIE_NAME,
  PUBLIC_PAGE_FONT_STORAGE_KEY,
  PUBLIC_PAGE_FONT_STYLE_ELEMENT_ID,
  PUBLIC_PAGE_FONT_STYLESHEET_ELEMENT_ID,
  type PublicPageFontOption,
  type PublicPageFontPreference,
  serializePublicPageFontPreference,
} from '@/lib/public-page-font'
import type { ThemeMode } from '@/lib/theme'
import { applyThemeModeWithTransition } from '@/lib/theme-mode-transition'

const DEFAULT_FONT_PREFERENCE_SNAPSHOT = serializePublicPageFontPreference()
const publicPageFontPreferenceListeners = new Set<() => void>()
const FONT_OPTION_ICONS = [Type, Pilcrow] as const
const RAIL_BUTTON_CLASS =
  'h-9 w-9 rounded-lg border border-border/65 bg-background text-muted-foreground shadow-[0_12px_28px_rgba(15,23,42,0.12)] transition-colors hover:bg-accent/70 hover:text-foreground sm:h-10 sm:w-10'
const PANEL_BUTTON_CLASS =
  'h-9 w-9 rounded-lg border transition-colors'
const THEME_BUTTONS: Array<{ icon: typeof Sun; labelKey: string; mode: ThemeMode }> = [
  { mode: 'light', icon: Sun, labelKey: 'ui.theme.switchToLight' },
  { mode: 'system', icon: Laptop, labelKey: 'ui.theme.switchToSystem' },
  { mode: 'dark', icon: Moon, labelKey: 'ui.theme.switchToDark' },
]

function serializePreferenceSnapshot(raw: unknown): string {
  return serializePublicPageFontPreference(normalizePublicPageFontPreference(raw))
}

function readPreferenceSnapshotFromDocumentCookie(): string {
  if (typeof document === 'undefined') {
    return DEFAULT_FONT_PREFERENCE_SNAPSHOT
  }

  const cookieItem = document.cookie
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${PUBLIC_PAGE_FONT_COOKIE_NAME}=`))

  if (!cookieItem) {
    return DEFAULT_FONT_PREFERENCE_SNAPSHOT
  }

  return serializePreferenceSnapshot(
    parsePublicPageFontCookie(cookieItem.slice(PUBLIC_PAGE_FONT_COOKIE_NAME.length + 1)),
  )
}

function readStoredPreferenceSnapshot(): string {
  if (typeof window === 'undefined') {
    return DEFAULT_FONT_PREFERENCE_SNAPSHOT
  }

  try {
    const raw = window.localStorage.getItem(PUBLIC_PAGE_FONT_STORAGE_KEY)
    if (raw) {
      return serializePreferenceSnapshot(raw)
    }
  } catch {
    // Ignore storage read failures in restricted contexts.
  }

  return readPreferenceSnapshotFromDocumentCookie()
}

function subscribeToPublicPageFontPreference(callback: () => void) {
  publicPageFontPreferenceListeners.add(callback)

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== PUBLIC_PAGE_FONT_STORAGE_KEY) return
    callback()
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', handleStorage)
  }

  return () => {
    publicPageFontPreferenceListeners.delete(callback)
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', handleStorage)
    }
  }
}

function notifyPublicPageFontPreferenceChange() {
  for (const callback of publicPageFontPreferenceListeners) {
    callback()
  }
}

function ensureStyleElement() {
  let styleElement = document.getElementById(
    PUBLIC_PAGE_FONT_STYLE_ELEMENT_ID,
  ) as HTMLStyleElement | null
  if (!styleElement) {
    styleElement = document.createElement('style')
    styleElement.id = PUBLIC_PAGE_FONT_STYLE_ELEMENT_ID
    document.head.appendChild(styleElement)
  }
  return styleElement
}

function syncRuntimeStyles(preference: PublicPageFontPreference) {
  if (typeof document === 'undefined') return

  const runtime = buildPublicPageFontRuntime(preference)
  const styleElement = ensureStyleElement()
  styleElement.textContent = runtime.cssText

  const existingLink = document.getElementById(
    PUBLIC_PAGE_FONT_STYLESHEET_ELEMENT_ID,
  ) as HTMLLinkElement | null

  if (runtime.stylesheetHref) {
    const linkElement = existingLink ?? document.createElement('link')
    linkElement.id = PUBLIC_PAGE_FONT_STYLESHEET_ELEMENT_ID
    linkElement.rel = 'stylesheet'
    linkElement.disabled = false
    linkElement.media = 'all'
    if (linkElement.getAttribute('href') !== runtime.stylesheetHref) {
      linkElement.setAttribute('href', runtime.stylesheetHref)
    }
    if (!existingLink) {
      document.head.appendChild(linkElement)
    }
    return
  }

  if (existingLink) {
    existingLink.disabled = true
    existingLink.media = 'not all'
    existingLink.removeAttribute('href')
  }
}

function persistPreference(preference: PublicPageFontPreference) {
  const normalizedPreference = normalizePublicPageFontPreference(preference)
  const nextSnapshot = serializePublicPageFontPreference(normalizedPreference)
  const currentSnapshot = readStoredPreferenceSnapshot()
  try {
    window.localStorage.setItem(PUBLIC_PAGE_FONT_STORAGE_KEY, nextSnapshot)
  } catch {
    // Ignore storage write failures in restricted contexts.
  }

  document.cookie = `${PUBLIC_PAGE_FONT_COOKIE_NAME}=${encodePublicPageFontPreferenceCookie(
    normalizedPreference,
  )}; path=/; max-age=31536000; samesite=lax`
  syncRuntimeStyles(normalizedPreference)
  if (currentSnapshot !== nextSnapshot) {
    notifyPublicPageFontPreferenceChange()
  }
}

function getPanelButtonClass(active: boolean) {
  return `${PANEL_BUTTON_CLASS} ${
    active
      ? 'border-primary/45 bg-primary/12 text-foreground'
      : 'border-border/45 bg-background/38 text-muted-foreground hover:bg-accent/50 hover:text-foreground'
  }`
}

export function PublicPageActionRail({
  fontOptions,
  visible,
}: {
  fontOptions: PublicPageFontOption[]
  visible: boolean
}) {
  const { t } = useT('common')
  const { setTheme, theme } = useTheme()
  const [open, setOpen] = useState(false)
  const [showByScroll, setShowByScroll] = useState(false)
  const storedFontPreferenceSnapshot = useSyncExternalStore(
    subscribeToPublicPageFontPreference,
    readStoredPreferenceSnapshot,
    () => DEFAULT_FONT_PREFERENCE_SNAPSHOT,
  )
  const storedFontPreference = useMemo(
    () => normalizePublicPageFontPreference(storedFontPreferenceSnapshot),
    [storedFontPreferenceSnapshot],
  )
  const fontPreference = useMemo(
    () => coercePublicPageFontPreferenceToOptions(storedFontPreference, fontOptions),
    [fontOptions, storedFontPreference],
  )
  const fontPreferenceSnapshot = useMemo(
    () => serializePublicPageFontPreference(fontPreference),
    [fontPreference],
  )
  const railVisible = visible && showByScroll
  const panelOpen = railVisible && open

  useEffect(() => {
    syncRuntimeStyles(fontPreference)

    if (storedFontPreferenceSnapshot !== fontPreferenceSnapshot) {
      persistPreference(fontPreference)
    }
  }, [fontPreference, fontPreferenceSnapshot, storedFontPreferenceSnapshot])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const threshold = 28
    const syncVisibility = () => {
      setShowByScroll(window.scrollY > threshold)
    }

    syncVisibility()
    window.addEventListener('scroll', syncVisibility, { passive: true })
    return () => {
      window.removeEventListener('scroll', syncVisibility)
    }
  }, [])

  const scrollToTop = () => {
    if (typeof window === 'undefined') return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({
      top: 0,
      behavior: reduceMotion ? 'auto' : 'smooth',
    })
  }

  return (
    <div
      className={`fixed bottom-[calc(env(safe-area-inset-bottom,0px)+1rem)] right-[calc(env(safe-area-inset-right,0px)+0.875rem)] z-30 flex flex-col gap-2 transition-all duration-300 sm:bottom-8 sm:right-4 ${
        railVisible
          ? 'pointer-events-auto translate-y-0 opacity-100'
          : 'pointer-events-none translate-y-3 opacity-0'
      }`.trim()}
    >
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        onClick={scrollToTop}
        aria-label={t('site.actionRail.goTop')}
        title={t('site.actionRail.goTop')}
        className={RAIL_BUTTON_CLASS}
      >
        <ArrowUp className="h-4 w-4" />
      </Button>

      <Popover open={panelOpen} onOpenChange={(nextOpen) => setOpen(railVisible && nextOpen)}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={t('site.actionRail.openPanel')}
            aria-pressed={panelOpen}
            title={t('site.actionRail.openPanel')}
            className={`${RAIL_BUTTON_CLASS} ${
              panelOpen ? 'border-primary/40 bg-accent text-foreground' : ''
            }`.trim()}
          >
            <Settings2 className="h-4 w-4" />
          </Button>
        </PopoverTrigger>

        <PopoverContent
          side="left"
          align="end"
          sideOffset={10}
          className="z-40 w-[9.25rem] rounded-lg border border-border/65 bg-popover p-2 shadow-[0_18px_40px_rgba(15,23,42,0.14)]"
        >
          <div className="grid gap-2">
            <div className="grid grid-cols-3 gap-2">
              {THEME_BUTTONS.map((item) => {
                const Icon = item.icon
                const active = theme === item.mode
                return (
                <Button
                  key={item.mode}
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => void applyThemeModeWithTransition(item.mode, setTheme)}
                  aria-label={t(item.labelKey)}
                  aria-pressed={active}
                  title={t(item.labelKey)}
                    className={getPanelButtonClass(active)}
                  >
                    <Icon className="h-4 w-4" />
                  </Button>
                )
              })}
            </div>

            <div className="h-px bg-border/50" />

            <div className="mx-auto flex w-fit items-center justify-center gap-2">
              {fontOptions.map((option, index) => {
                const Icon = FONT_OPTION_ICONS[index] ?? Type
                const active = matchesPublicPageFontOption(fontPreference, option)
                const label =
                  option.label.trim() || option.family.trim() || t('site.preferences.defaultFont')

                return (
                  <Button
                    key={`${option.mode}-${option.label}-${option.family}-${option.url ?? ''}`}
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    onClick={() =>
                      persistPreference(buildPublicPageFontPreferenceFromOption(option))
                    }
                    aria-label={label}
                    aria-pressed={active}
                    title={label}
                    className={getPanelButtonClass(active)}
                  >
                    <Icon className="h-4 w-4" />
                  </Button>
                )
              })}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
