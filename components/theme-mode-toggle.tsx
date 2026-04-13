'use client'

import { Laptop, Moon, Sun } from 'lucide-react'
import { useT } from 'next-i18next/client'
import { useEffect, useSyncExternalStore } from 'react'

import { useTheme } from '@/components/theme-provider'
import type { ThemeMode } from '@/lib/theme'
type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void | Promise<void>) => {
    ready: Promise<void>
    finished: Promise<void>
  }
}

const OPTIONS: Array<{
  labelKey: string
  value: ThemeMode
  icon: typeof Sun
}> = [
  { labelKey: 'ui.theme.switchToLight', value: 'light', icon: Sun },
  { labelKey: 'ui.theme.switchToSystem', value: 'system', icon: Laptop },
  { labelKey: 'ui.theme.switchToDark', value: 'dark', icon: Moon },
]

export function ThemeModeToggle({ className = '' }: { className?: string }) {
  const { t } = useT('common')
  const { theme, resolvedTheme, setTheme } = useTheme()
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  )

  const applyThemeMode = (mode: ThemeMode) => {
    setTheme(mode)
    if (typeof document === 'undefined') return

    const root = document.documentElement
    if (mode === 'dark') {
      root.classList.add('dark')
      return
    }
    if (mode === 'light') {
      root.classList.remove('dark')
      return
    }

    const prefersDark =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    root.classList.toggle('dark', prefersDark)
  }

  useEffect(() => {
    if (!mounted || typeof document === 'undefined') return

    const root = document.documentElement
    const desired = theme === 'light' || theme === 'dark' ? theme : resolvedTheme
    root.classList.toggle('dark', desired === 'dark')
  }, [mounted, resolvedTheme, theme])

  const activeTheme: ThemeMode =
    mounted && (theme === 'light' || theme === 'dark' || theme === 'system') ? theme : 'system'

  return (
    <div
      className={`inline-flex rounded-full border border-border/80 bg-card/90 p-[3px] text-foreground shadow-sm backdrop-blur-md ${className}`.trim()}
      role="group"
      aria-label={t('ui.theme.switcher')}
    >
      {OPTIONS.map((option) => {
        const Icon = option.icon
        const active = activeTheme === option.value
        return (
          <button
            key={option.value}
            aria-label={t(option.labelKey)}
            type="button"
            onClick={async (event) => {
              if (!mounted) return
              if (
                option.value === activeTheme &&
                !(option.value === 'system' && theme !== 'system')
              ) {
                return
              }

              const reduceMotion =
                typeof window !== 'undefined' &&
                window.matchMedia('(prefers-reduced-motion: reduce)').matches
              const doc = document as ViewTransitionDocument
              const transitionApi = doc.startViewTransition

              if (!transitionApi || reduceMotion) {
                applyThemeMode(option.value)
                return
              }

              const { clientX, clientY } = event
              const maxX = Math.max(clientX, window.innerWidth - clientX)
              const maxY = Math.max(clientY, window.innerHeight - clientY)
              const endRadius = Math.hypot(maxX, maxY)
              const root = document.documentElement
              root.style.setProperty('--theme-switch-x', `${clientX}px`)
              root.style.setProperty('--theme-switch-y', `${clientY}px`)
              root.style.setProperty('--theme-switch-end-radius', `${endRadius}px`)

              const transition = transitionApi.call(doc, () => {
                applyThemeMode(option.value)
              })

              await transition.ready
              root.dataset.themeSwitch = 'active'

              const animation = root.animate(
                {
                  clipPath: [
                    `circle(0px at ${clientX}px ${clientY}px)`,
                    `circle(${endRadius}px at ${clientX}px ${clientY}px)`,
                  ],
                },
                {
                  duration: 720,
                  easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
                  pseudoElement: '::view-transition-new(root)',
                },
              )

              await animation.finished.catch(() => undefined)
              delete root.dataset.themeSwitch
            }}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-full border-0 transition-colors ${
              active
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
            }`}
          >
            <Icon className="h-4 w-4" strokeWidth={1.6} />
          </button>
        )
      })}
    </div>
  )
}
