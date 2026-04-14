'use client'

import { useT } from 'next-i18next/client'

import {
  useAdminBackgroundColor,
  useAdminThemeColor,
} from '@/components/admin/admin-theme-runtime'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  ADMIN_BACKGROUND_COLOR_FALLBACK,
  ADMIN_THEME_COLOR_FALLBACK,
  writeAdminBackgroundColor,
  writeAdminThemeColor,
} from '@/lib/admin-theme-color'

export function AdminThemeColorControl() {
  const { t } = useT('admin')
  const color = useAdminThemeColor()
  const backgroundColor = useAdminBackgroundColor()
  const previewColor = color ?? ADMIN_THEME_COLOR_FALLBACK
  const previewBackgroundColor = backgroundColor ?? ADMIN_BACKGROUND_COLOR_FALLBACK

  return (
    <div className="grid gap-3 xl:grid-cols-2">
      <div className="space-y-3 rounded-xl border border-border/60 bg-background/70 p-4">
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
              onChange={(event) => writeAdminThemeColor(event.target.value.toUpperCase())}
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
                  {color
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
            onClick={() => writeAdminThemeColor(null)}
            disabled={!color}
          >
            {t('webSettings.adminThemeColorReset')}
          </Button>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-border/60 bg-background/70 p-4">
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
              onChange={(event) => writeAdminBackgroundColor(event.target.value.toUpperCase())}
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
            onClick={() => writeAdminBackgroundColor(null)}
            disabled={!backgroundColor}
          >
            {t('webSettings.adminBackgroundColorReset')}
          </Button>
        </div>
      </div>
    </div>
  )
}
