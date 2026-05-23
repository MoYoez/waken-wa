'use client'

import { useAtom } from 'jotai'
import { useT } from 'next-i18next/client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import { previewThemeRandomImage, uploadImageSource } from '@/components/admin/admin-query-mutations'
import { WebSettingsCustomSurfaceInsetPanel } from '@/components/admin/web-settings-custom-surface-inset-panel'
import { WebSettingsCustomSurfaceStylePanel } from '@/components/admin/web-settings-custom-surface-style-panel'
import {
  webSettingsFormAtom,
  webSettingsMigrationAtom,
} from '@/components/admin/web-settings-store'
import { hasThemeImageSourceConfigured } from '@/components/admin/web-settings-utils'
import {
  CreateEmptyThemePreviewAsset,
  GetThemeCustomSurfaceBackgroundInputValue,
  GetThemeCustomSurfacePreviewHint,
  GetThemeCustomSurfaceUploadUsageKey,
} from '@/lib/theme-custom-surface-preview'
import { extractThemeSurfaceFromImageAsset, loadPaletteImage } from '@/lib/theme-image-palette'
import { loadThemeSurfaceActiveImageAsset } from '@/lib/theme-image-source'
import type {
  ThemeCustomSurfaceForm,
  ThemeCustomSurfacePreviewAssetState,
} from '@/types/web-settings'

export function WebSettingsCustomSurface() {
  const { t } = useT('admin')
  const [form, setForm] = useAtom(webSettingsFormAtom)
  const [migration] = useAtom(webSettingsMigrationAtom)
  const value = form.themeCustomSurface
  const [backgroundImageInput, setBackgroundImageInput] = useState('')
  const [themePreviewImageUrl, setThemePreviewImageUrl] = useState('')
  const [themePreviewLoading, setThemePreviewLoading] = useState(false)
  const [themePaletteApplying, setThemePaletteApplying] = useState(false)
  const themePreviewAssetRef = useRef<ThemeCustomSurfacePreviewAssetState>(
    CreateEmptyThemePreviewAsset(),
  )
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
    return GetThemeCustomSurfacePreviewHint({
      backgroundImageMode: value.backgroundImageMode,
      backgroundImageUrl: value.backgroundImageUrl,
      backgroundImagePool: value.backgroundImagePool,
      backgroundRandomApiUrl: value.backgroundRandomApiUrl,
    })
  }, [
    value.backgroundImageMode,
    value.backgroundImagePool,
    value.backgroundImageUrl,
    value.backgroundRandomApiUrl,
  ])

  function clearThemePreviewAsset() {
    themePreviewAssetRef.current.revoke?.()
    themePreviewAssetRef.current = CreateEmptyThemePreviewAsset()
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
    setBackgroundImageInput(GetThemeCustomSurfaceBackgroundInputValue({
      backgroundImageMode: value.backgroundImageMode,
      backgroundImageUrl: value.backgroundImageUrl,
      backgroundImagePool: value.backgroundImagePool,
      backgroundRandomApiUrl: value.backgroundRandomApiUrl,
    }))
  }, [
    value.backgroundImageMode,
    value.backgroundImagePool,
    value.backgroundImageUrl,
    value.backgroundRandomApiUrl,
  ])

  const resolveThemePreviewImage = async () => {
    setThemePreviewLoading(true)
    try {
      const asset = await loadThemeSurfaceActiveImageAsset(value, {
        resolver: async (apiUrl) => previewThemeRandomImage(apiUrl),
      })
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
    reader.onload = async () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      if (!result) {
        toast.error(t('webSettingsCustomSurface.toasts.readImageFailed'))
        return
      }
      const usageKey = GetThemeCustomSurfaceUploadUsageKey(value)
      let imageUrl = ''
      try {
        imageUrl = await uploadImageSource(result, usageKey)
      } catch {
        toast.error(t('webSettingsCustomSurface.toasts.readImageFailed'))
        return
      }
      if (value.backgroundImageMode === 'randomPool') {
        patchThemeSurfaceImageAware({
          backgroundImagePool: [...value.backgroundImagePool, imageUrl],
        })
      } else {
        patchThemeSurfaceImageAware({ backgroundImageUrl: imageUrl })
      }
      setBackgroundImageInput('')
      clearThemePreviewAsset()
      setThemePreviewImageUrl(imageUrl)
    }
    reader.onerror = () => {
      toast.error(t('webSettingsCustomSurface.toasts.readImageFailed'))
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className={`space-y-4 ${themeLocked ? 'pointer-events-none opacity-60' : ''}`}>
      <p className="text-xs leading-relaxed text-muted-foreground">
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
      <p className="text-xs leading-relaxed text-muted-foreground">
        {t('webSettingsCustomSurface.introLine2Prefix')}
        <code className="rounded bg-muted px-1">url(&quot;...&quot;)</code>{' '}
        {t('webSettingsCustomSurface.introLine2Middle')}{' '}
        <code className="rounded bg-muted px-1">background</code>{' '}
        {t('webSettingsCustomSurface.introLine2AfterBackground')}
        {t('webSettingsCustomSurface.introLine2SuffixPrefix')}{' '}
        <code className="rounded bg-muted px-1">body</code>
        {t('webSettingsCustomSurface.introLine2Suffix')}
      </p>
      <WebSettingsCustomSurfaceInsetPanel
        value={value}
        backgroundImageInput={backgroundImageInput}
        themePreviewImageUrl={themePreviewImageUrl}
        currentThemePreviewHint={currentThemePreviewHint}
        themePreviewLoading={themePreviewLoading}
        themePaletteApplying={themePaletteApplying}
        onBackgroundImageInputChange={setBackgroundImageInput}
        onSetThemePreviewImageUrl={setThemePreviewImageUrl}
        onPatchThemeSurface={patchThemeSurface}
        onPatchThemeSurfaceImageAware={patchThemeSurfaceImageAware}
        onAddThemeBackgroundImage={addThemeBackgroundImage}
        onThemeBackgroundFileSelected={onThemeBackgroundFileSelected}
        onResolveThemePreviewImage={resolveThemePreviewImage}
        onApplyPaletteFromCurrentThemeImage={applyPaletteFromCurrentThemeImage}
      />
      <WebSettingsCustomSurfaceStylePanel
        value={value}
        onPatchThemeSurface={patchThemeSurface}
      />
    </div>
  )
}
