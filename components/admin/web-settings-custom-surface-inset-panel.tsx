'use client'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useT } from 'next-i18next/client'

import {
  getAdminPanelTransition,
  getAdminSectionVariants,
} from '@/components/admin/admin-motion'
import { FileSelectTrigger } from '@/components/admin/file-select-trigger'
import { WebSettingsInset } from '@/components/admin/web-settings-layout'
import { Button } from '@/components/ui/button'
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
import {
  ResolveThemeBackgroundImageMode,
  ResolveThemePaletteLiveScope,
  ResolveThemePaletteMode,
} from '@/lib/theme-custom-surface-preview'
import type { ThemeCustomSurfaceForm } from '@/types/web-settings'

type PatchThemeSurface = <K extends keyof ThemeCustomSurfaceForm>(
  key: K,
  fieldValue: ThemeCustomSurfaceForm[K],
) => void

type WebSettingsCustomSurfaceInsetPanelProps = {
  value: ThemeCustomSurfaceForm
  backgroundImageInput: string
  themePreviewImageUrl: string
  currentThemePreviewHint: string
  themePreviewLoading: boolean
  themePaletteApplying: boolean
  onBackgroundImageInputChange: (value: string) => void
  onSetThemePreviewImageUrl: (value: string) => void
  onPatchThemeSurface: PatchThemeSurface
  onPatchThemeSurfaceImageAware: (patches: Partial<ThemeCustomSurfaceForm>) => void
  onAddThemeBackgroundImage: () => void
  onThemeBackgroundFileSelected: (file?: File) => void
  onResolveThemePreviewImage: () => Promise<string>
  onApplyPaletteFromCurrentThemeImage: () => Promise<void>
}

export function WebSettingsCustomSurfaceInsetPanel({
  value,
  backgroundImageInput,
  themePreviewImageUrl,
  currentThemePreviewHint,
  themePreviewLoading,
  themePaletteApplying,
  onBackgroundImageInputChange,
  onSetThemePreviewImageUrl,
  onPatchThemeSurface,
  onPatchThemeSurfaceImageAware,
  onAddThemeBackgroundImage,
  onThemeBackgroundFileSelected,
  onResolveThemePreviewImage,
  onApplyPaletteFromCurrentThemeImage,
}: WebSettingsCustomSurfaceInsetPanelProps) {
  const { t } = useT('admin')
  const prefersReducedMotion = Boolean(useReducedMotion())
  const sectionTransition = getAdminPanelTransition(prefersReducedMotion)
  const sectionVariants = getAdminSectionVariants(prefersReducedMotion, {
    enterY: 10,
    exitY: 8,
    scale: 0.996,
  })

  return (
    <WebSettingsInset className="space-y-4">
      <div className="space-y-2">
        <Label>{t('webSettingsCustomSurface.backgroundSourceLabel')}</Label>
        <Select
          value={value.backgroundImageMode}
          onValueChange={(nextValue) =>
            onPatchThemeSurface(
              'backgroundImageMode',
              ResolveThemeBackgroundImageMode(nextValue),
            )
          }
        >
          <SelectTrigger className="w-full sm:max-w-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="manual">
              {t('webSettingsCustomSurface.backgroundModes.manual')}
            </SelectItem>
            <SelectItem value="randomPool">
              {t('webSettingsCustomSurface.backgroundModes.randomPool')}
            </SelectItem>
            <SelectItem value="randomApi">
              {t('webSettingsCustomSurface.backgroundModes.randomApi')}
            </SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {t('webSettingsCustomSurface.backgroundSourceHintPrefix')}{' '}
          <code className="rounded bg-muted px-1">body background</code>
          {t('webSettingsCustomSurface.backgroundSourceHintSuffix')}
        </p>
      </div>

      <AnimatePresence initial={false} mode="wait">
        {value.backgroundImageMode === 'manual' ? (
          <motion.div
            key="theme-surface-manual"
            className="space-y-3"
            variants={sectionVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={sectionTransition}
            layout
          >
            <div className="space-y-2">
              <Label>{t('webSettingsCustomSurface.manualImageLabel')}</Label>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Input
                  value={backgroundImageInput}
                  onChange={(e) => {
                    onBackgroundImageInputChange(e.target.value)
                    onPatchThemeSurfaceImageAware({ backgroundImageUrl: e.target.value })
                  }}
                  placeholder="https://… / /images/bg.jpg / data:image/..."
                  className="min-w-0 basis-full flex-1 font-mono text-xs sm:min-w-[18rem] sm:basis-auto"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onSetThemePreviewImageUrl(backgroundImageInput.trim())}
                >
                  {t('webSettingsCustomSurface.previewThisImage')}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('webSettingsCustomSurface.importLocalImageLabel')}</Label>
              <FileSelectTrigger
                accept="image/*"
                buttonLabel={t('common.selectFile')}
                emptyLabel={t('common.noFileSelected')}
                onSelect={onThemeBackgroundFileSelected}
              />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence initial={false} mode="wait">
        {value.backgroundImageMode === 'randomPool' ? (
          <motion.div
            key="theme-surface-random-pool"
            className="space-y-3"
            variants={sectionVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={sectionTransition}
            layout
          >
            <div className="space-y-2">
              <Label>{t('webSettingsCustomSurface.randomPoolLabel')}</Label>
              <div className="flex flex-wrap gap-2">
                <Input
                  value={backgroundImageInput}
                  onChange={(e) => onBackgroundImageInputChange(e.target.value)}
                  placeholder={t('webSettingsCustomSurface.randomPoolPlaceholder')}
                  className="min-w-0 basis-full flex-1 font-mono text-xs sm:min-w-[18rem] sm:basis-auto"
                />
                <Button type="button" onClick={onAddThemeBackgroundImage}>
                  {t('webSettingsCustomSurface.addToPool')}
                </Button>
              </div>
            </div>
            <FileSelectTrigger
              accept="image/*"
              buttonLabel={t('common.selectFile')}
              emptyLabel={t('common.noFileSelected')}
              onSelect={onThemeBackgroundFileSelected}
            />
            {value.backgroundImagePool.length > 0 ? (
              <motion.div
                className="max-h-44 space-y-2 overflow-y-auto rounded-md border border-border bg-background/60 p-2.5 sm:p-3"
                layout
              >
                <AnimatePresence initial={false}>
                  {value.backgroundImagePool.map((item, index) => (
                    <motion.div
                      key={`${item.slice(0, 32)}-${index}`}
                      className="flex items-center justify-between gap-3 rounded-md border border-border bg-background/70 px-2.5 py-2 sm:px-3"
                      variants={sectionVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      transition={sectionTransition}
                      layout
                    >
                      <button
                        type="button"
                        className="min-w-0 flex-1 truncate text-left text-xs text-foreground"
                        onClick={() => onSetThemePreviewImageUrl(item)}
                      >
                        {item}
                      </button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="shrink-0"
                        onClick={() =>
                          onPatchThemeSurface(
                            'backgroundImagePool',
                            value.backgroundImagePool.filter((_, i) => i !== index),
                          )
                        }
                      >
                        {t('common.delete')}
                      </Button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t('webSettingsCustomSurface.randomPoolEmpty')}
              </p>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence initial={false} mode="wait">
        {value.backgroundImageMode === 'randomApi' ? (
          <motion.div
            key="theme-surface-random-api"
            className="space-y-3"
            variants={sectionVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={sectionTransition}
            layout
          >
            <div className="space-y-2">
              <Label>{t('webSettingsCustomSurface.randomApiLabel')}</Label>
              <div className="flex flex-wrap gap-2">
                <Input
                  value={backgroundImageInput}
                  onChange={(e) => {
                    onBackgroundImageInputChange(e.target.value)
                    onPatchThemeSurfaceImageAware({
                      backgroundRandomApiUrl: e.target.value,
                    })
                  }}
                  placeholder="https://api.example.com/random-image"
                  className="min-w-0 basis-full flex-1 font-mono text-xs sm:min-w-[18rem] sm:basis-auto"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => void onResolveThemePreviewImage()}
                >
                  {t('webSettingsCustomSurface.fetchPreviewImage')}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t('webSettingsCustomSurface.randomApiHintPrefix')}{' '}
                <code className="rounded bg-muted px-1">url</code> /
                <code className="rounded bg-muted px-1">image</code> /
                <code className="rounded bg-muted px-1">urls.regular</code>
                {t('webSettingsCustomSurface.randomApiHintSuffix')}
              </p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="space-y-5">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => void onResolveThemePreviewImage()}
              disabled={themePreviewLoading}
            >
              {themePreviewLoading
                ? t('webSettingsCustomSurface.generatingPreview')
                : t('webSettingsCustomSurface.generatePreview')}
            </Button>
            <Button
              type="button"
              onClick={() => void onApplyPaletteFromCurrentThemeImage()}
              disabled={themePaletteApplying || themePreviewLoading}
            >
              {themePaletteApplying
                ? t('webSettingsCustomSurface.applyingPalette')
                : t('webSettingsCustomSurface.applyPalette')}
            </Button>
          </div>
          <div className="flex flex-col gap-3 py-1 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                {t('webSettingsCustomSurface.livePaletteTitle')}
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t('webSettingsCustomSurface.livePaletteDescription')}
              </p>
            </div>
            <Switch
              checked={value.paletteLiveEnabled}
              onCheckedChange={(checked) => onPatchThemeSurface('paletteLiveEnabled', checked)}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t('webSettingsCustomSurface.paletteModeLabel')}</Label>
              <Select
                value={value.paletteMode}
                onValueChange={(nextValue) =>
                  onPatchThemeSurface(
                    'paletteMode',
                    ResolveThemePaletteMode(nextValue),
                  )
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">
                    {t('webSettingsCustomSurface.paletteModes.manual')}
                  </SelectItem>
                  <SelectItem value="applyFromCurrent">
                    {t('webSettingsCustomSurface.paletteModes.applyFromCurrent')}
                  </SelectItem>
                  <SelectItem value="liveFromImage">
                    {t('webSettingsCustomSurface.paletteModes.liveFromImage')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('webSettingsCustomSurface.paletteScopeLabel')}</Label>
              <Select
                value={value.paletteLiveScope}
                onValueChange={(nextValue) =>
                  onPatchThemeSurface(
                    'paletteLiveScope',
                    ResolveThemePaletteLiveScope(nextValue),
                  )
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="randomOnly">
                    {t('webSettingsCustomSurface.paletteScopes.randomOnly')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="break-all text-xs text-muted-foreground leading-relaxed">
            {t('webSettingsCustomSurface.lastPaletteSeedImage', {
              value: value.paletteSeedImageUrl || t('webSettingsCustomSurface.none'),
            })}
          </p>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              {t('webSettingsCustomSurface.currentPreviewTitle')}
            </p>
            <p className="break-all text-xs text-muted-foreground">
              {themePreviewImageUrl ||
                currentThemePreviewHint ||
                t('webSettingsCustomSurface.toasts.noPreviewImage')}
            </p>
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-muted/20">
            <AnimatePresence initial={false} mode="wait">
              {themePreviewImageUrl ? (
                <motion.div
                  key="theme-preview-image"
                  variants={sectionVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={sectionTransition}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- admin preview supports arbitrary URLs/data URLs */}
                  <img
                    src={themePreviewImageUrl}
                    alt={t('webSettingsCustomSurface.previewAlt')}
                    className="h-48 w-full object-cover"
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="theme-preview-empty"
                  className="flex h-48 items-center justify-center px-3 text-center text-xs text-muted-foreground sm:px-4"
                  variants={sectionVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={sectionTransition}
                >
                  {t('webSettingsCustomSurface.previewEmptyHint')}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[
              ['background', value.background],
              ['primary', value.primary],
              ['accent', value.accent],
              ['card', value.card],
            ].map(([label, color]) => (
              <div key={label} className="space-y-1">
                <div
                  className="h-10 rounded-md border border-border"
                  style={{ background: String(color || 'transparent') }}
                />
                <p className="truncate text-[11px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </WebSettingsInset>
  )
}
