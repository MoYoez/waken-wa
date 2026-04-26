'use client'

import { useAtom } from 'jotai'
import { useT } from 'next-i18next/client'

import { WebSettingsInset } from '@/components/admin/web-settings-layout'
import {
  webSettingsFormAtom,
  webSettingsMigrationAtom,
} from '@/components/admin/web-settings-store'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

export function WebSettingsPublicFontsPanel() {
  const { t } = useT('admin')
  const [form, setForm] = useAtom(webSettingsFormAtom)
  const [migration] = useAtom(webSettingsMigrationAtom)
  const themeLocked = migration?.heavyEditingLocked === true

  const patch = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const patchPublicFontOption = (
    index: number,
    key: keyof (typeof form.publicFontOptions)[number],
    value: string,
  ) => {
    setForm((prev) => {
      const nextOptions = prev.publicFontOptions.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item,
      )
      return {
        ...prev,
        publicFontOptions: nextOptions,
      }
    })
  }

  return (
    <WebSettingsInset
      className={cn('space-y-4', themeLocked && 'pointer-events-none opacity-60')}
    >
      <div className="space-y-1">
        <Label>{t('webSettingsBasic.publicFontsTitle')}</Label>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {t('webSettingsBasic.publicFontsHint')}
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/10 px-4 py-3">
        <div className="min-w-0 space-y-0.5">
          <Label htmlFor="public-font-options-enabled" className="cursor-pointer font-normal">
            {t('webSettingsBasic.publicFontsEnabledTitle')}
          </Label>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t('webSettingsBasic.publicFontsEnabledDescription')}
          </p>
        </div>
        <Switch
          id="public-font-options-enabled"
          checked={form.publicFontOptionsEnabled}
          onCheckedChange={(value) => patch('publicFontOptionsEnabled', value)}
          className="shrink-0"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {form.publicFontOptions.map((option, index) => (
          <div
            key={`public-font-option-${index + 1}`}
            className="space-y-3 rounded-lg border border-border/60 bg-background/40 p-4"
          >
            <p className="text-xs font-medium text-foreground/80">
              {t('webSettingsBasic.publicFontsOptionTitle', { index: index + 1 })}
            </p>

            <div className="space-y-2">
              <Label htmlFor={`public-font-option-label-${index}`}>
                {t('webSettingsBasic.publicFontsLabel')}
              </Label>
              <Input
                id={`public-font-option-label-${index}`}
                value={option.label}
                onChange={(event) => patchPublicFontOption(index, 'label', event.target.value)}
                placeholder={t('webSettingsBasic.publicFontsLabelPlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`public-font-option-mode-${index}`}>
                {t('webSettingsBasic.publicFontsModeLabel')}
              </Label>
              <Select
                value={option.mode}
                onValueChange={(value) => patchPublicFontOption(index, 'mode', value)}
              >
                <SelectTrigger id={`public-font-option-mode-${index}`} className="w-full">
                  <SelectValue placeholder={t('webSettingsBasic.publicFontsModePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">
                    {t('webSettingsBasic.publicFontsModes.default')}
                  </SelectItem>
                  <SelectItem value="google">
                    {t('webSettingsBasic.publicFontsModes.google')}
                  </SelectItem>
                  <SelectItem value="custom">
                    {t('webSettingsBasic.publicFontsModes.custom')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`public-font-option-family-${index}`}>
                {t('webSettingsBasic.publicFontsFamilyLabel')}
              </Label>
              <Input
                id={`public-font-option-family-${index}`}
                value={option.family}
                disabled={option.mode === 'default'}
                onChange={(event) => patchPublicFontOption(index, 'family', event.target.value)}
                placeholder={t('webSettingsBasic.publicFontsFamilyPlaceholder')}
              />
            </div>

            {option.mode === 'custom' ? (
              <div className="space-y-2">
                <Label htmlFor={`public-font-option-url-${index}`}>
                  {t('webSettingsBasic.publicFontsUrlLabel')}
                </Label>
                <Input
                  id={`public-font-option-url-${index}`}
                  value={option.url}
                  onChange={(event) => patchPublicFontOption(index, 'url', event.target.value)}
                  placeholder={t('webSettingsBasic.publicFontsUrlPlaceholder')}
                />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </WebSettingsInset>
  )
}
