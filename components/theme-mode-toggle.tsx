'use client'

import { Laptop, Moon, Sun } from 'lucide-react'
import { useT } from 'next-i18next/client'
import { useEffect, useSyncExternalStore } from 'react'

import { useTheme } from '@/components/theme-provider'
import type { ThemeMode } from '@/lib/theme'
import { applyThemeModeWithTransition } from '@/lib/theme-mode-transition'

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

              await applyThemeModeWithTransition(option.value, setTheme)
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
