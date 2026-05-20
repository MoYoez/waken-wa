'use client'

import { useT } from 'next-i18next/client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { THEME_CUSTOM_SURFACE_DEFAULTS } from '@/lib/theme-custom-surface'
import type { ThemeCustomSurfaceForm } from '@/types/web-settings'

type PatchThemeSurface = <K extends keyof ThemeCustomSurfaceForm>(
  key: K,
  fieldValue: ThemeCustomSurfaceForm[K],
) => void

type WebSettingsCustomSurfaceStylePanelProps = {
  value: ThemeCustomSurfaceForm
  onPatchThemeSurface: PatchThemeSurface
}

export function WebSettingsCustomSurfaceStylePanel({
  value,
  onPatchThemeSurface,
}: WebSettingsCustomSurfaceStylePanelProps) {
  const { t } = useT('admin')

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2 sm:col-span-2">
        <Label>{t('webSettingsCustomSurface.backgroundLabel')}</Label>
        <p className="text-xs text-muted-foreground">
          {t('webSettingsCustomSurface.backgroundHintPrefix')}{' '}
          <code className="rounded bg-muted px-1">--background</code>、
          <code className="rounded bg-muted px-1">--color-background</code>
          {t('webSettingsCustomSurface.backgroundHintMiddle')}{' '}
          <code className="rounded bg-muted px-1">bg-background</code>
          {t('webSettingsCustomSurface.backgroundHintSuffix')}
          {' '}
          {t('webSettingsCustomSurface.backgroundHintExtendedPrefix')}{' '}
          <code className="rounded bg-muted px-1">background:</code>{' '}
          {t('webSettingsCustomSurface.backgroundHintExtendedMiddle')}{' '}
          <code className="rounded bg-muted px-1">.animated-bg</code>{' '}
          {t('webSettingsCustomSurface.backgroundHintExtendedAfterAnimatedBg')}{' '}
          <code className="rounded bg-muted px-1">body</code>
          {t('webSettingsCustomSurface.backgroundHintExtendedSuffix')}
        </p>
        <Input
          value={value.background}
          onChange={(e) => onPatchThemeSurface('background', e.target.value)}
          placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.background}
          className="max-w-xl font-mono text-xs"
        />
      </div>

      <div className="space-y-2">
        <Label>{t('webSettingsCustomSurface.primaryLabel')}</Label>
        <Input
          value={value.primary}
          onChange={(e) => onPatchThemeSurface('primary', e.target.value)}
          placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.primary}
          className="font-mono text-xs"
        />
      </div>

      <div className="space-y-2">
        <Label>{t('webSettingsCustomSurface.foregroundLabel')}</Label>
        <Input
          value={value.foreground}
          onChange={(e) => onPatchThemeSurface('foreground', e.target.value)}
          placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.foreground}
          className="font-mono text-xs"
        />
      </div>

      <div className="space-y-2">
        <Label>{t('webSettingsCustomSurface.secondaryLabel')}</Label>
        <Input
          value={value.secondary}
          onChange={(e) => onPatchThemeSurface('secondary', e.target.value)}
          placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.secondary}
          className="font-mono text-xs"
        />
      </div>

      <div className="space-y-2">
        <Label>{t('webSettingsCustomSurface.accentLabel')}</Label>
        <Input
          value={value.accent}
          onChange={(e) => onPatchThemeSurface('accent', e.target.value)}
          placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.accent}
          className="font-mono text-xs"
        />
      </div>

      <div className="space-y-2">
        <Label>{t('webSettingsCustomSurface.cardLabel')}</Label>
        <Input
          value={value.card}
          onChange={(e) => onPatchThemeSurface('card', e.target.value)}
          placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.card}
          className="font-mono text-xs"
        />
      </div>

      <div className="space-y-2">
        <Label>{t('webSettingsCustomSurface.borderLabel')}</Label>
        <Input
          value={value.border}
          onChange={(e) => onPatchThemeSurface('border', e.target.value)}
          placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.border}
          className="font-mono text-xs"
        />
      </div>

      <div className="space-y-2">
        <Label>{t('webSettingsCustomSurface.mutedLabel')}</Label>
        <Input
          value={value.muted}
          onChange={(e) => onPatchThemeSurface('muted', e.target.value)}
          placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.muted}
          className="font-mono text-xs"
        />
      </div>

      <div className="space-y-2">
        <Label>{t('webSettingsCustomSurface.mutedForegroundLabel')}</Label>
        <Input
          value={value.mutedForeground}
          onChange={(e) => onPatchThemeSurface('mutedForeground', e.target.value)}
          placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.mutedForeground}
          className="font-mono text-xs"
        />
      </div>

      <div className="space-y-2">
        <Label>{t('webSettingsCustomSurface.onlineLabel')}</Label>
        <Input
          value={value.online}
          onChange={(e) => onPatchThemeSurface('online', e.target.value)}
          placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.online}
          className="font-mono text-xs"
        />
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label>{t('webSettingsCustomSurface.radiusLabel')}</Label>
        <Input
          value={value.radius}
          onChange={(e) => onPatchThemeSurface('radius', e.target.value)}
          placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.radius}
          className="max-w-xs font-mono text-xs"
        />
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label>{t('webSettingsCustomSurface.bodyBackgroundLabel')}</Label>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {t('webSettingsCustomSurface.bodyBackgroundHintPrefix')}{' '}
          <code className="rounded bg-muted px-1">body</code>{' '}
          {t('webSettingsCustomSurface.bodyBackgroundHintMiddle')}{' '}
          <code className="rounded bg-muted px-1">background:</code>
          {t('webSettingsCustomSurface.bodyBackgroundHintSuffix')}
        </p>
        <textarea
          rows={4}
          value={value.bodyBackground}
          onChange={(e) => onPatchThemeSurface('bodyBackground', e.target.value)}
          placeholder='e.g. url("https://…") center/cover no-repeat, linear-gradient(168deg, oklch(0.98 0.01 82), oklch(0.94 0.02 78))'
          className="w-full rounded-md border bg-background px-2.5 py-2 text-xs font-mono leading-relaxed sm:px-3"
        />
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label>{t('webSettingsCustomSurface.animatedBgLabel')}</Label>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {t('webSettingsCustomSurface.animatedBgHint')}
        </p>
        <Label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={value.transparentAnimatedBg}
            onChange={(e) => onPatchThemeSurface('transparentAnimatedBg', e.target.checked)}
          />
          <span className="text-sm">{t('webSettingsCustomSurface.transparentAnimatedBgLabel')}</span>
        </Label>
        <textarea
          rows={5}
          value={value.animatedBg}
          onChange={(e) => onPatchThemeSurface('animatedBg', e.target.value)}
          placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.animatedBg}
          disabled={value.transparentAnimatedBg}
          className="w-full rounded-md border bg-background px-2.5 py-2 text-xs font-mono leading-relaxed disabled:cursor-not-allowed disabled:opacity-50 sm:px-3"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 sm:col-span-2">
        <div className="space-y-2">
          <Label>{t('webSettingsCustomSurface.animatedBgTint1Label')}</Label>
          <Input
            value={value.animatedBgTint1}
            onChange={(e) => onPatchThemeSurface('animatedBgTint1', e.target.value)}
            placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.animatedBgTint1}
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-2">
          <Label>{t('webSettingsCustomSurface.animatedBgTint2Label')}</Label>
          <Input
            value={value.animatedBgTint2}
            onChange={(e) => onPatchThemeSurface('animatedBgTint2', e.target.value)}
            placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.animatedBgTint2}
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-2">
          <Label>{t('webSettingsCustomSurface.animatedBgTint3Label')}</Label>
          <Input
            value={value.animatedBgTint3}
            onChange={(e) => onPatchThemeSurface('animatedBgTint3', e.target.value)}
            placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.animatedBgTint3}
            className="font-mono text-xs"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 sm:col-span-2">
        <div className="space-y-2">
          <Label>{t('webSettingsCustomSurface.floatingOrbColor1Label')}</Label>
          <Input
            value={value.floatingOrbColor1}
            onChange={(e) => onPatchThemeSurface('floatingOrbColor1', e.target.value)}
            placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.floatingOrbColor1}
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-2">
          <Label>{t('webSettingsCustomSurface.floatingOrbColor2Label')}</Label>
          <Input
            value={value.floatingOrbColor2}
            onChange={(e) => onPatchThemeSurface('floatingOrbColor2', e.target.value)}
            placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.floatingOrbColor2}
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-2">
          <Label>{t('webSettingsCustomSurface.floatingOrbColor3Label')}</Label>
          <Input
            value={value.floatingOrbColor3}
            onChange={(e) => onPatchThemeSurface('floatingOrbColor3', e.target.value)}
            placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.floatingOrbColor3}
            className="font-mono text-xs"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 sm:col-span-2">
        <div className="space-y-2">
          <Label>{t('webSettingsCustomSurface.homeCardOverlayLabel')}</Label>
          <Input
            value={value.homeCardOverlay}
            onChange={(e) => onPatchThemeSurface('homeCardOverlay', e.target.value)}
            placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.homeCardOverlay}
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-2">
          <Label>{t('webSettingsCustomSurface.homeCardOverlayDarkLabel')}</Label>
          <Input
            value={value.homeCardOverlayDark}
            onChange={(e) => onPatchThemeSurface('homeCardOverlayDark', e.target.value)}
            placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.homeCardOverlayDark}
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>{t('webSettingsCustomSurface.homeCardInsetHighlightLabel')}</Label>
          <Input
            value={value.homeCardInsetHighlight}
            onChange={(e) => onPatchThemeSurface('homeCardInsetHighlight', e.target.value)}
            placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.homeCardInsetHighlight}
            className="max-w-xl font-mono text-xs"
          />
        </div>
      </div>

      <Label className="flex cursor-pointer items-center gap-2 sm:col-span-2">
        <input
          type="checkbox"
          checked={value.hideFloatingOrbs}
          onChange={(e) => onPatchThemeSurface('hideFloatingOrbs', e.target.checked)}
        />
        <span className="text-sm">{t('webSettingsCustomSurface.hideFloatingOrbsLabel')}</span>
      </Label>
    </div>
  )
}
