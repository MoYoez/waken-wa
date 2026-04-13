'use client'

import { Languages } from 'lucide-react'
import { useT } from 'next-i18next/client'
import { useCallback } from 'react'

import { DEFAULT_LANGUAGE } from '@/i18n.config'
import {
  ADMIN_LANGUAGE_COOKIE_NAME,
  normalizeRequestLanguage,
} from '@/lib/i18n/request-locale'

const OPTIONS = [
  {
    labelKey: 'admin.language.zhCN',
    shortLabel: 'ZH',
    titleKey: 'admin.language.switchToZhCN',
    value: 'zh-CN',
  },
  {
    labelKey: 'admin.language.en',
    shortLabel: 'EN',
    titleKey: 'admin.language.switchToEn',
    value: 'en',
  },
] as const

export function AdminLanguageToggle({ className = '' }: { className?: string }) {
  const { i18n, t } = useT('common')
  const activeLanguage =
    normalizeRequestLanguage(i18n.resolvedLanguage || i18n.language) ?? DEFAULT_LANGUAGE
  const changeLanguage = useCallback(
    async (nextLanguage: 'zh-CN' | 'en') => {
      document.cookie = `${ADMIN_LANGUAGE_COOKIE_NAME}=${nextLanguage}; path=/; max-age=${365 * 24 * 60 * 60}; SameSite=Lax`
      document.documentElement.lang = nextLanguage
      await i18n.changeLanguage(nextLanguage)
    },
    [i18n],
  )

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-full border border-border/80 bg-card/90 p-[3px] text-foreground shadow-sm backdrop-blur-md ${className}`.trim()}
      role="group"
      aria-label={t('admin.language.ariaLabel')}
    >
      <span className="inline-flex h-8 w-8 items-center justify-center text-muted-foreground">
        <Languages className="h-4 w-4" strokeWidth={1.8} />
      </span>
      {OPTIONS.map((option) => {
        const active = activeLanguage === option.value
        return (
          <button
            key={option.value}
            type="button"
            aria-label={t(option.titleKey)}
            title={t(option.titleKey)}
            onClick={() => {
              if (option.value === activeLanguage) return
              void changeLanguage(option.value)
            }}
            className={`inline-flex h-8 min-w-10 items-center justify-center rounded-full px-3 text-xs font-medium transition-colors ${
              active
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
            }`}
          >
            <span className="sm:hidden">{option.shortLabel}</span>
            <span className="hidden sm:inline">{t(option.labelKey)}</span>
          </button>
        )
      })}
    </div>
  )
}
