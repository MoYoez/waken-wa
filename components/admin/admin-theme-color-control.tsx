'use client'

import { useT } from 'next-i18next/client'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  ADMIN_BACKGROUND_COLOR_FALLBACK,
  ADMIN_THEME_COLOR_FALLBACK,
} from '@/lib/admin-theme-color'

type AdminThemeColorControlProps = {
  themeColor: string
  backgroundColor: string
  onThemeColorChange: (value: string) => void
  onBackgroundColorChange: (value: string) => void
}

export function AdminThemeColorControl({
  themeColor,
  backgroundColor,
  onThemeColorChange,
  onBackgroundColorChange,
}: AdminThemeColorControlProps) {
  const { t } = useT('admin')
  const previewColor = themeColor || ADMIN_THEME_COLOR_FALLBACK
  const previewBackgroundColor = backgroundColor || ADMIN_BACKGROUND_COLOR_FALLBACK

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="space-y-3">
        <Label htmlFor="admin-theme-color">{t('webSettings.adminThemeColorLabel')}</Label>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {t('webSettings.adminThemeColorHint')}
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <input
              id="admin-theme-color"
              type="color"
              className="h-10 w-16 cursor-pointer rounded-lg border border-input bg-background p-1 shadow-xs"
              value={previewColor}
              onChange={(event) => onThemeColorChange(event.target.value.toUpperCase())}
              aria-label={t('webSettings.adminThemeColorAriaLabel')}
            />
            <div className="min-w-0 space-y-1">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-2.5 py-1 text-[11px] text-muted-foreground">
                <span
                  className="h-2.5 w-2.5 rounded-full border border-black/10"
                  style={{ backgroundColor: previewColor }}
                  aria-hidden
                />
                <span>
                  {themeColor
                    ? t('webSettings.adminThemeColorCustom')
                    : t('webSettings.adminThemeColorDefault')}
                </span>
              </div>
              <p className="font-mono text-xs text-foreground">{previewColor}</p>
            </div>
          </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onThemeColorChange('')}
              disabled={!themeColor}
            >
              {t('webSettings.adminThemeColorReset')}
            </Button>
        </div>
      </div>

      <div className="space-y-3">
        <Label htmlFor="admin-background-color">{t('webSettings.adminBackgroundColorLabel')}</Label>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {t('webSettings.adminBackgroundColorHint')}
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <input
              id="admin-background-color"
              type="color"
              className="h-10 w-16 cursor-pointer rounded-lg border border-input bg-background p-1 shadow-xs"
              value={previewBackgroundColor}
              onChange={(event) => onBackgroundColorChange(event.target.value.toUpperCase())}
              aria-label={t('webSettings.adminBackgroundColorAriaLabel')}
            />
            <div className="min-w-0 space-y-1">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-2.5 py-1 text-[11px] text-muted-foreground">
                <span
                  className="h-2.5 w-2.5 rounded-full border border-black/10"
                  style={{ backgroundColor: previewBackgroundColor }}
                  aria-hidden
                />
                <span>
                  {backgroundColor
                    ? t('webSettings.adminThemeColorCustom')
                    : t('webSettings.adminThemeColorDefault')}
                </span>
              </div>
              <p className="font-mono text-xs text-foreground">{previewBackgroundColor}</p>
            </div>
          </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onBackgroundColorChange('')}
              disabled={!backgroundColor}
            >
              {t('webSettings.adminBackgroundColorReset')}
          </Button>
        </div>
      </div>
    </div>
  )
}
