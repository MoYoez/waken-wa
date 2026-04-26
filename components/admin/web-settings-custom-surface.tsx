'use client'

import { useAtom } from 'jotai'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useT } from 'next-i18next/client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import {
  getAdminPanelTransition,
  getAdminSectionVariants,
} from '@/components/admin/admin-motion'
import { FileSelectTrigger } from '@/components/admin/file-select-trigger'
import { WebSettingsInset } from '@/components/admin/web-settings-layout'
import {
  webSettingsFormAtom,
  webSettingsMigrationAtom,
} from '@/components/admin/web-settings-store'
import type { ThemeCustomSurfaceForm } from '@/components/admin/web-settings-types'
import { hasThemeImageSourceConfigured } from '@/components/admin/web-settings-utils'
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
import { THEME_CUSTOM_SURFACE_DEFAULTS } from '@/lib/theme-custom-surface'
import { extractThemeSurfaceFromImageAsset, loadPaletteImage } from '@/lib/theme-image-palette'
import { loadThemeSurfaceActiveImageAsset } from '@/lib/theme-image-source'
import { cn } from '@/lib/utils'

type ThemePreviewAssetState = {
  displayUrl: string
  seedUrl: string
  image: HTMLImageElement | null
  revoke?: () => void
}

function createEmptyThemePreviewAsset(): ThemePreviewAssetState {
  return {
    displayUrl: '',
    seedUrl: '',
    image: null,
  }
}

export function WebSettingsCustomSurface() {
  const { t } = useT('admin')
  const [form, setForm] = useAtom(webSettingsFormAtom)
  const [migration] = useAtom(webSettingsMigrationAtom)
  const value = form.themeCustomSurface
  const [backgroundImageInput, setBackgroundImageInput] = useState('')
  const [themePreviewImageUrl, setThemePreviewImageUrl] = useState('')
  const [themePreviewLoading, setThemePreviewLoading] = useState(false)
  const [themePaletteApplying, setThemePaletteApplying] = useState(false)
  const themePreviewAssetRef = useRef<ThemePreviewAssetState>(createEmptyThemePreviewAsset())
  const prefersReducedMotion = Boolean(useReducedMotion())
  const sectionTransition = getAdminPanelTransition(prefersReducedMotion)
  const sectionVariants = getAdminSectionVariants(prefersReducedMotion, {
    enterY: 10,
    exitY: 8,
    scale: 0.996,
  })
  const themeLocked = migration?.heavyEditingLocked === true

  const setThemeCustomSurface = (next: ThemeCustomSurfaceForm) => {
    setForm((prev) => ({ ...prev, themeCustomSurface: next }))
  }

  const patchThemeSurface = <K extends keyof ThemeCustomSurfaceForm>(
    key: K,
    fieldValue: ThemeCustomSurfaceForm[K],
  ) => {
    setThemeCustomSurface({ ...value, [key]: fieldValue })
  }

  const patchThemeSurfaceImageAware = (patches: Partial<ThemeCustomSurfaceForm>) => {
    const nextThemeCustomSurface = {
      ...value,
      ...patches,
    }
    const hadImageSource = hasThemeImageSourceConfigured(value)
    const hasImageSource = hasThemeImageSourceConfigured(nextThemeCustomSurface)
    if (!hadImageSource && hasImageSource) {
      nextThemeCustomSurface.hideFloatingOrbs = true
      nextThemeCustomSurface.transparentAnimatedBg = true
    }
    setThemeCustomSurface(nextThemeCustomSurface)
  }

  const currentThemePreviewHint = useMemo(() => {
    if (value.backgroundImageMode === 'manual') {
      return value.backgroundImageUrl.trim()
    }
    if (value.backgroundImageMode === 'randomPool') {
      return value.backgroundImagePool[0] ?? ''
    }
    return value.backgroundRandomApiUrl.trim()
  }, [
    value.backgroundImageMode,
    value.backgroundImagePool,
    value.backgroundImageUrl,
    value.backgroundRandomApiUrl,
  ])

  function clearThemePreviewAsset() {
    themePreviewAssetRef.current.revoke?.()
    themePreviewAssetRef.current = createEmptyThemePreviewAsset()
  }

  useEffect(() => {
    clearThemePreviewAsset()
    setThemePreviewImageUrl('')
    setThemePreviewLoading(false)
  }, [
    value.backgroundImageMode,
    value.backgroundImageUrl,
    value.backgroundImagePool,
    value.backgroundRandomApiUrl,
  ])

  useEffect(() => () => clearThemePreviewAsset(), [])

  useEffect(() => {
    if (value.backgroundImageMode === 'manual') {
      setBackgroundImageInput(value.backgroundImageUrl)
      return
    }
    if (value.backgroundImageMode === 'randomApi') {
      setBackgroundImageInput(value.backgroundRandomApiUrl)
      return
    }
    setBackgroundImageInput('')
  }, [
    value.backgroundImageMode,
    value.backgroundImageUrl,
    value.backgroundRandomApiUrl,
  ])

  const resolveThemePreviewImage = async () => {
    setThemePreviewLoading(true)
    try {
      const asset = await loadThemeSurfaceActiveImageAsset(value)
      clearThemePreviewAsset()
      if (!asset) {
        setThemePreviewImageUrl('')
        toast.error(t('webSettingsCustomSurface.toasts.noPreviewImage'))
        return ''
      }
      themePreviewAssetRef.current = {
        displayUrl: asset.displayUrl,
        seedUrl: asset.seedUrl,
        image: null,
        revoke: asset.revoke,
      }
      setThemePreviewImageUrl(asset.displayUrl)
      return asset.displayUrl
    } catch {
      toast.error(t('webSettingsCustomSurface.toasts.resolvePreviewFailed'))
      return ''
    } finally {
      setThemePreviewLoading(false)
    }
  }

  const applyPaletteFromCurrentThemeImage = async () => {
    setThemePaletteApplying(true)
    try {
      if (!themePreviewAssetRef.current.image) {
        if (!themePreviewAssetRef.current.displayUrl) {
          await resolveThemePreviewImage()
        }
        if (themePreviewAssetRef.current.displayUrl) {
          themePreviewAssetRef.current.image = await loadPaletteImage(
            themePreviewAssetRef.current.displayUrl,
          )
        }
      }
      const asset = themePreviewAssetRef.current
      if (!asset.displayUrl || !asset.image) return
      const nextTheme = await extractThemeSurfaceFromImageAsset({
        displayUrl: asset.displayUrl,
        seedUrl: asset.seedUrl,
        image: asset.image,
      })
      setThemeCustomSurface({
        ...value,
        ...nextTheme,
        paletteLiveScope: value.paletteLiveScope,
        paletteLiveEnabled: value.paletteLiveEnabled,
      })
      setThemePreviewImageUrl(asset.displayUrl)
      toast.success(t('webSettingsCustomSurface.toasts.paletteApplied'))
    } catch {
      toast.error(t('webSettingsCustomSurface.toasts.paletteFailed'))
    } finally {
      setThemePaletteApplying(false)
    }
  }

  const addThemeBackgroundImage = () => {
    const nextValue = backgroundImageInput.trim()
    if (!nextValue) return

    if (value.backgroundImageMode === 'randomPool') {
      const exists = value.backgroundImagePool.some((item) => item === nextValue)
      if (exists) {
        toast.error(t('webSettingsCustomSurface.toasts.duplicatePoolImage'))
        return
      }
      patchThemeSurfaceImageAware({
        backgroundImagePool: [...value.backgroundImagePool, nextValue],
      })
      setBackgroundImageInput('')
      return
    }

    patchThemeSurfaceImageAware({ backgroundImageUrl: nextValue })
    setBackgroundImageInput(nextValue)
  }

  const onThemeBackgroundFileSelected = (file?: File) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      if (!result) {
        toast.error(t('webSettingsCustomSurface.toasts.readImageFailed'))
        return
      }
      if (value.backgroundImageMode === 'randomPool') {
        patchThemeSurfaceImageAware({
          backgroundImagePool: [...value.backgroundImagePool, result],
        })
      } else {
        patchThemeSurfaceImageAware({ backgroundImageUrl: result })
      }
      setBackgroundImageInput('')
      clearThemePreviewAsset()
      setThemePreviewImageUrl(result)
    }
    reader.onerror = () => {
      toast.error(t('webSettingsCustomSurface.toasts.readImageFailed'))
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className={cn('space-y-4', themeLocked && 'pointer-events-none opacity-60')}>
      <p className="text-xs text-muted-foreground leading-relaxed">
        {t('webSettingsCustomSurface.introLine1Prefix')}{' '}
        <code className="rounded bg-muted px-1">url()</code>
        {t('webSettingsCustomSurface.introLine1Middle')}{' '}
        <code className="rounded bg-muted px-1">https://…</code>、
        <code className="rounded bg-muted px-1">http://…</code>、
        <code className="rounded bg-muted px-1">/images/bg.jpg</code>、
        <code className="rounded bg-muted px-1">./a.png</code>、
        <code className="rounded bg-muted px-1">data:image/…;base64,…</code>
        {t('webSettingsCustomSurface.introLine1Suffix')}
      </p>
      <p className="text-xs text-muted-foreground leading-relaxed">
        {t('webSettingsCustomSurface.introLine2Prefix')}
        <code className="rounded bg-muted px-1">url(&quot;...&quot;)</code>{' '}
        {t('webSettingsCustomSurface.introLine2Middle')}{' '}
        <code className="rounded bg-muted px-1">background</code>{' '}
        {t('webSettingsCustomSurface.introLine2AfterBackground')}
        {t('webSettingsCustomSurface.introLine2SuffixPrefix')}{' '}
        <code className="rounded bg-muted px-1">body</code>
        {t('webSettingsCustomSurface.introLine2Suffix')}
      </p>
      <WebSettingsInset className="space-y-4">
        <div className="space-y-2">
          <Label>{t('webSettingsCustomSurface.backgroundSourceLabel')}</Label>
          <Select
            value={value.backgroundImageMode}
            onValueChange={(nextValue) =>
              patchThemeSurface(
                'backgroundImageMode',
                nextValue === 'randomPool' || nextValue === 'randomApi' ? nextValue : 'manual',
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
                    setBackgroundImageInput(e.target.value)
                    patchThemeSurfaceImageAware({ backgroundImageUrl: e.target.value })
                  }}
                  placeholder="https://… / /images/bg.jpg / data:image/..."
                  className="min-w-0 basis-full flex-1 font-mono text-xs sm:min-w-[18rem] sm:basis-auto"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setThemePreviewImageUrl(backgroundImageInput.trim())}
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
                  onChange={(e) => setBackgroundImageInput(e.target.value)}
                  placeholder={t('webSettingsCustomSurface.randomPoolPlaceholder')}
                  className="min-w-0 basis-full flex-1 font-mono text-xs sm:min-w-[18rem] sm:basis-auto"
                />
                <Button type="button" onClick={addThemeBackgroundImage}>
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
                className="max-h-44 space-y-2 overflow-y-auto rounded-md border border-border/60 bg-background/60 p-2.5 sm:p-3"
                layout
              >
                <AnimatePresence initial={false}>
                  {value.backgroundImagePool.map((item, index) => (
                    <motion.div
                      key={`${item.slice(0, 32)}-${index}`}
                      className="flex items-center justify-between gap-3 rounded-md border border-border/50 bg-background/70 px-2.5 py-2 sm:px-3"
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
                        onClick={() => setThemePreviewImageUrl(item)}
                      >
                        {item}
                      </button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="shrink-0"
                        onClick={() =>
                          patchThemeSurface(
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
                    setBackgroundImageInput(e.target.value)
                    patchThemeSurfaceImageAware({
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
                  onClick={() => void resolveThemePreviewImage()}
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
                onClick={() => void resolveThemePreviewImage()}
                disabled={themePreviewLoading}
              >
                {themePreviewLoading
                  ? t('webSettingsCustomSurface.generatingPreview')
                  : t('webSettingsCustomSurface.generatePreview')}
              </Button>
              <Button
                type="button"
                onClick={() => void applyPaletteFromCurrentThemeImage()}
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
                onCheckedChange={(checked) => patchThemeSurface('paletteLiveEnabled', checked)}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('webSettingsCustomSurface.paletteModeLabel')}</Label>
                <Select
                  value={value.paletteMode}
                  onValueChange={(nextValue) =>
                    patchThemeSurface(
                      'paletteMode',
                      nextValue === 'applyFromCurrent' || nextValue === 'liveFromImage'
                        ? nextValue
                        : 'manual',
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
                    patchThemeSurface(
                      'paletteLiveScope',
                      nextValue === 'randomOnly' ? nextValue : 'randomOnly',
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
            <div className="overflow-hidden rounded-xl border border-border/60 bg-muted/20">
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
                    className="flex h-48 items-center justify-center px-3 sm:px-4 text-center text-xs text-muted-foreground"
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
                    className="h-10 rounded-md border border-border/60"
                    style={{ background: String(color || 'transparent') }}
                  />
                  <p className="truncate text-[11px] text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </WebSettingsInset>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label>{t('webSettingsCustomSurface.backgroundLabel')}</Label>
          <p className="text-xs text-muted-foreground">
            {t('webSettingsCustomSurface.backgroundHintPrefix')}{' '}
            <code className="rounded bg-muted px-1">--background</code>、
            <code className="rounded bg-muted px-1">--color-background</code>
            {t('webSettingsCustomSurface.backgroundHintMiddle')}{' '}
            <code className="rounded bg-muted px-1">bg-background</code>
            {t('webSettingsCustomSurface.backgroundHintSuffix')}
            {' '}{t('webSettingsCustomSurface.backgroundHintExtendedPrefix')}{' '}
            <code className="rounded bg-muted px-1">background:</code>{' '}
            {t('webSettingsCustomSurface.backgroundHintExtendedMiddle')}{' '}
            <code className="rounded bg-muted px-1">.animated-bg</code>{' '}
            {t('webSettingsCustomSurface.backgroundHintExtendedAfterAnimatedBg')}{' '}
            <code className="rounded bg-muted px-1">body</code>
            {t('webSettingsCustomSurface.backgroundHintExtendedSuffix')}
          </p>
          <Input
            value={value.background}
            onChange={(e) => patchThemeSurface('background', e.target.value)}
            placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.background}
            className="max-w-xl font-mono text-xs"
          />
        </div>
        <div className="space-y-2">
          <Label>{t('webSettingsCustomSurface.primaryLabel')}</Label>
          <Input
            value={value.primary}
            onChange={(e) => patchThemeSurface('primary', e.target.value)}
            placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.primary}
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-2">
          <Label>{t('webSettingsCustomSurface.foregroundLabel')}</Label>
          <Input
            value={value.foreground}
            onChange={(e) => patchThemeSurface('foreground', e.target.value)}
            placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.foreground}
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-2">
          <Label>{t('webSettingsCustomSurface.secondaryLabel')}</Label>
          <Input
            value={value.secondary}
            onChange={(e) => patchThemeSurface('secondary', e.target.value)}
            placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.secondary}
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-2">
          <Label>{t('webSettingsCustomSurface.accentLabel')}</Label>
          <Input
            value={value.accent}
            onChange={(e) => patchThemeSurface('accent', e.target.value)}
            placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.accent}
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-2">
          <Label>{t('webSettingsCustomSurface.cardLabel')}</Label>
          <Input
            value={value.card}
            onChange={(e) => patchThemeSurface('card', e.target.value)}
            placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.card}
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-2">
          <Label>{t('webSettingsCustomSurface.borderLabel')}</Label>
          <Input
            value={value.border}
            onChange={(e) => patchThemeSurface('border', e.target.value)}
            placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.border}
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-2">
          <Label>{t('webSettingsCustomSurface.mutedLabel')}</Label>
          <Input
            value={value.muted}
            onChange={(e) => patchThemeSurface('muted', e.target.value)}
            placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.muted}
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-2">
          <Label>{t('webSettingsCustomSurface.mutedForegroundLabel')}</Label>
          <Input
            value={value.mutedForeground}
            onChange={(e) => patchThemeSurface('mutedForeground', e.target.value)}
            placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.mutedForeground}
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-2">
          <Label>{t('webSettingsCustomSurface.onlineLabel')}</Label>
          <Input
            value={value.online}
            onChange={(e) => patchThemeSurface('online', e.target.value)}
            placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.online}
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>{t('webSettingsCustomSurface.radiusLabel')}</Label>
          <Input
            value={value.radius}
            onChange={(e) => patchThemeSurface('radius', e.target.value)}
            placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.radius}
            className="max-w-xs font-mono text-xs"
          />
        </div>
      </div>
      <div className="space-y-2">
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
          onChange={(e) => patchThemeSurface('bodyBackground', e.target.value)}
          placeholder='e.g. url("https://…") center/cover no-repeat, linear-gradient(168deg, oklch(0.98 0.01 82), oklch(0.94 0.02 78))'
          className="w-full rounded-md border bg-background px-2.5 py-2 text-xs font-mono leading-relaxed sm:px-3"
        />
      </div>
      <div className="space-y-2">
        <Label>{t('webSettingsCustomSurface.animatedBgLabel')}</Label>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {t('webSettingsCustomSurface.animatedBgHint')}
        </p>
        <Label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={value.transparentAnimatedBg}
            onChange={(e) => patchThemeSurface('transparentAnimatedBg', e.target.checked)}
          />
          <span className="text-sm">{t('webSettingsCustomSurface.transparentAnimatedBgLabel')}</span>
        </Label>
        <textarea
          rows={5}
          value={value.animatedBg}
          onChange={(e) => patchThemeSurface('animatedBg', e.target.value)}
          placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.animatedBg}
          disabled={value.transparentAnimatedBg}
          className="w-full rounded-md border bg-background px-2.5 py-2 text-xs font-mono leading-relaxed disabled:cursor-not-allowed disabled:opacity-50 sm:px-3"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{t('webSettingsCustomSurface.animatedBgTint1Label')}</Label>
          <Input
            value={value.animatedBgTint1}
            onChange={(e) => patchThemeSurface('animatedBgTint1', e.target.value)}
            placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.animatedBgTint1}
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-2">
          <Label>{t('webSettingsCustomSurface.animatedBgTint2Label')}</Label>
          <Input
            value={value.animatedBgTint2}
            onChange={(e) => patchThemeSurface('animatedBgTint2', e.target.value)}
            placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.animatedBgTint2}
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-2">
          <Label>{t('webSettingsCustomSurface.animatedBgTint3Label')}</Label>
          <Input
            value={value.animatedBgTint3}
            onChange={(e) => patchThemeSurface('animatedBgTint3', e.target.value)}
            placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.animatedBgTint3}
            className="font-mono text-xs"
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{t('webSettingsCustomSurface.floatingOrbColor1Label')}</Label>
          <Input
            value={value.floatingOrbColor1}
            onChange={(e) => patchThemeSurface('floatingOrbColor1', e.target.value)}
            placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.floatingOrbColor1}
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-2">
          <Label>{t('webSettingsCustomSurface.floatingOrbColor2Label')}</Label>
          <Input
            value={value.floatingOrbColor2}
            onChange={(e) => patchThemeSurface('floatingOrbColor2', e.target.value)}
            placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.floatingOrbColor2}
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-2">
          <Label>{t('webSettingsCustomSurface.floatingOrbColor3Label')}</Label>
          <Input
            value={value.floatingOrbColor3}
            onChange={(e) => patchThemeSurface('floatingOrbColor3', e.target.value)}
            placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.floatingOrbColor3}
            className="font-mono text-xs"
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{t('webSettingsCustomSurface.homeCardOverlayLabel')}</Label>
          <Input
            value={value.homeCardOverlay}
            onChange={(e) => patchThemeSurface('homeCardOverlay', e.target.value)}
            placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.homeCardOverlay}
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-2">
          <Label>{t('webSettingsCustomSurface.homeCardOverlayDarkLabel')}</Label>
          <Input
            value={value.homeCardOverlayDark}
            onChange={(e) => patchThemeSurface('homeCardOverlayDark', e.target.value)}
            placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.homeCardOverlayDark}
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>{t('webSettingsCustomSurface.homeCardInsetHighlightLabel')}</Label>
          <Input
            value={value.homeCardInsetHighlight}
            onChange={(e) => patchThemeSurface('homeCardInsetHighlight', e.target.value)}
            placeholder={THEME_CUSTOM_SURFACE_DEFAULTS.homeCardInsetHighlight}
            className="max-w-xl font-mono text-xs"
          />
        </div>
      </div>
      <Label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={value.hideFloatingOrbs}
          onChange={(e) => patchThemeSurface('hideFloatingOrbs', e.target.checked)}
        />
        <span className="text-sm">{t('webSettingsCustomSurface.hideFloatingOrbsLabel')}</span>
      </Label>
    </div>
  )
}
