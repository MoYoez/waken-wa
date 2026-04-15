'use client'

import { useEffect, useMemo, useRef } from 'react'

import {
  buildCustomSurfaceCss,
  isThemePaletteLiveEnabled,
  parseThemeCustomSurface,
  resolveThemeBackgroundImageMode,
  resolveThemePaletteLiveScope,
  resolveThemePaletteMode,
} from '@/lib/theme-custom-surface'
import { extractThemeSurfaceFromLoadedImage, loadPaletteImage } from '@/lib/theme-image-palette'
import {
  buildThemeSurfaceResolvedImageDisplayUrl,
  loadThemeSurfaceActiveImageAsset,
  resolveThemeSurfaceFixedImageTarget,
} from '@/lib/theme-image-source'
import type { ThemeCustomSurfaceFields } from '@/types/theme'

type Props = {
  themePreset: string | null | undefined
  themeCustomSurface: unknown
}

type ThemeRuntimeImageAsset = {
  displayUrl: string
  seedUrl: string
}

type ThemeRuntimeCacheValue = {
  css: string
  fixedImageUrl: string
  renderUrl: string
}

type ThemeRuntimeCacheRecord =
  | {
      status: 'pending'
      promise: Promise<ThemeRuntimeCacheValue | null>
    }
  | {
      status: 'ready'
      value: ThemeRuntimeCacheValue
    }

const THEME_RUNTIME_CACHE_MAX_ITEMS = 8

declare global {
  var __wakenThemeRuntimeCache: Map<string, ThemeRuntimeCacheRecord> | undefined
}

function getThemeRuntimeCache(): Map<string, ThemeRuntimeCacheRecord> {
  if (!globalThis.__wakenThemeRuntimeCache) {
    globalThis.__wakenThemeRuntimeCache = new Map<string, ThemeRuntimeCacheRecord>()
  }
  return globalThis.__wakenThemeRuntimeCache
}

function rememberThemeRuntimeCacheValue(key: string, value: ThemeRuntimeCacheValue) {
  const cache = getThemeRuntimeCache()
  cache.delete(key)
  cache.set(key, { status: 'ready', value })

  while (cache.size > THEME_RUNTIME_CACHE_MAX_ITEMS) {
    const oldestKey = cache.keys().next().value as string | undefined
    if (!oldestKey) break
    cache.delete(oldestKey)
  }
}

function getOrCreateThemeRuntimeCachePromise(
  key: string,
  factory: () => Promise<ThemeRuntimeCacheValue | null>,
): Promise<ThemeRuntimeCacheValue | null> {
  const cache = getThemeRuntimeCache()
  const existing = cache.get(key)
  if (existing?.status === 'ready') {
    return Promise.resolve(existing.value)
  }
  if (existing?.status === 'pending') {
    return existing.promise
  }

  const promise = factory()
    .then((value) => {
      if (value) {
        rememberThemeRuntimeCacheValue(key, value)
      } else if (cache.get(key)?.status === 'pending') {
        cache.delete(key)
      }
      return value
    })
    .catch((error) => {
      if (cache.get(key)?.status === 'pending') {
        cache.delete(key)
      }
      throw error
    })

  cache.set(key, { status: 'pending', promise })
  return promise
}

function buildResolvedBackgroundCss(url: string) {
  return url ? `url(${JSON.stringify(url)}) center / cover no-repeat` : ''
}

function buildThemeRuntimeBackgroundCss(url: string): string {
  const background = buildResolvedBackgroundCss(url)
  return background
    ? `body { background: ${background}; background-position: 50% 50%; background-size: cover; background-repeat: no-repeat; }`
    : ''
}

function shouldApplyLivePalette(parsed: ThemeCustomSurfaceFields): boolean {
  const liveEnabled = isThemePaletteLiveEnabled(parsed)
  const paletteMode = resolveThemePaletteMode(parsed)
  const paletteScope = resolveThemePaletteLiveScope(parsed)
  const mode = resolveThemeBackgroundImageMode(parsed)
  return (
    liveEnabled &&
    paletteMode === 'liveFromImage' &&
    paletteScope === 'randomOnly' &&
    (mode === 'randomPool' || mode === 'randomApi')
  )
}

function buildThemeRuntimeCacheSignature(
  themePreset: string | null | undefined,
  parsed: ThemeCustomSurfaceFields,
): string | null {
  const mode = resolveThemeBackgroundImageMode(parsed)
  if (themePreset !== 'customSurface') return null
  if (mode !== 'randomPool' && mode !== 'randomApi') return null

  return JSON.stringify({
    themePreset,
    backgroundImageMode: mode,
    backgroundImagePool: Array.isArray(parsed.backgroundImagePool) ? parsed.backgroundImagePool : [],
    backgroundRandomApiUrl: String(parsed.backgroundRandomApiUrl ?? '').trim(),
    paletteMode: resolveThemePaletteMode(parsed),
    paletteLiveEnabled: isThemePaletteLiveEnabled(parsed),
    paletteLiveScope: resolveThemePaletteLiveScope(parsed),
    // Cache entries reuse the final CSS, so include the parsed surface to invalidate
    // when live-palette output would otherwise keep stale custom-surface tokens.
    themeCustomSurface: parsed,
  })
}

async function buildThemeRuntimeCss(
  parsed: ThemeCustomSurfaceFields,
  asset: ThemeRuntimeImageAsset,
): Promise<string> {
  const bodyCss = buildThemeRuntimeBackgroundCss(asset.displayUrl)
  if (!bodyCss) return ''
  if (!shouldApplyLivePalette(parsed)) return bodyCss

  try {
    const image = await loadPaletteImage(asset.displayUrl)
    const paletteTheme = extractThemeSurfaceFromLoadedImage(image, asset.seedUrl)
    const css = buildCustomSurfaceCss({
      ...parsed,
      ...paletteTheme,
      paletteMode: 'liveFromImage',
    })
    return `${css}\n${bodyCss}`
  } catch {
    return bodyCss
  }
}

async function buildThemeRuntimeCacheValue(
  parsed: ThemeCustomSurfaceFields,
): Promise<ThemeRuntimeCacheValue | null> {
  const fixedTarget = await resolveThemeSurfaceFixedImageTarget(parsed)
  if (!fixedTarget?.url) return null

  const renderUrl = buildThemeSurfaceResolvedImageDisplayUrl(fixedTarget)
  if (!renderUrl) return null

  const css = await buildThemeRuntimeCss(parsed, {
    displayUrl: renderUrl,
    seedUrl: fixedTarget.url,
  })

  return {
    css,
    fixedImageUrl: fixedTarget.url,
    renderUrl,
  }
}

async function loadThemeRuntimeCssFromActiveSource(
  parsed: ThemeCustomSurfaceFields,
  options?: { signal?: AbortSignal },
): Promise<string> {
  const asset = await loadThemeSurfaceActiveImageAsset(parsed, options)
  if (!asset) return ''
  return buildThemeRuntimeCss(parsed, asset)
}

export function SiteThemeRuntime({ themePreset, themeCustomSurface }: Props) {
  const parsed = useMemo(() => parseThemeCustomSurface(themeCustomSurface), [themeCustomSurface])
  const cacheKey = useMemo(
    () => buildThemeRuntimeCacheSignature(themePreset, parsed),
    [parsed, themePreset],
  )
  const readyTicketRef = useRef(0)
  const styleRef = useRef<HTMLStyleElement | null>(null)

  const emitThemeReadyAfterPaint = (nextCss: string) => {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    const ticket = readyTicketRef.current + 1
    readyTicketRef.current = ticket
    if (styleRef.current) {
      styleRef.current.textContent = nextCss
    }
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (readyTicketRef.current !== ticket) return
        root.dataset.themeReady = 'true'
        window.dispatchEvent(new Event('site-theme-ready'))
      })
    })
  }

  useEffect(() => {
    if (typeof document === 'undefined') return
    document.documentElement.dataset.themeReady = 'false'
  }, [themeCustomSurface, themePreset])

  useEffect(() => {
    if (typeof document === 'undefined') return
    if (themePreset !== 'customSurface') {
      emitThemeReadyAfterPaint('')
    }
  }, [themePreset])

  useEffect(() => {
    if (themePreset !== 'customSurface') {
      return
    }

    let cancelled = false
    const abortController = new AbortController()

    const applyCss = (nextCss: string) => {
      if (cancelled) return
      emitThemeReadyAfterPaint(nextCss)
    }

    void (async () => {
      if (cacheKey) {
        const existing = getThemeRuntimeCache().get(cacheKey)
        if (existing?.status === 'ready') {
          applyCss(existing.value.css)
          return
        }

        try {
          const cachedValue = await getOrCreateThemeRuntimeCachePromise(cacheKey, () =>
            buildThemeRuntimeCacheValue(parsed),
          )
          if (cachedValue) {
            applyCss(cachedValue.css)
            return
          }
          const fallbackCss = await loadThemeRuntimeCssFromActiveSource(parsed, {
            signal: abortController.signal,
          })
          applyCss(fallbackCss)
        } catch {
          try {
            const fallbackCss = await loadThemeRuntimeCssFromActiveSource(parsed, {
              signal: abortController.signal,
            })
            applyCss(fallbackCss)
          } catch {
            applyCss('')
          }
        }
        return
      }

      try {
        const css = await loadThemeRuntimeCssFromActiveSource(parsed, {
          signal: abortController.signal,
        })
        applyCss(css)
      } catch {
        applyCss('')
      }
    })()

    return () => {
      cancelled = true
      abortController.abort()
    }
  }, [cacheKey, parsed, themePreset])

  return <style ref={styleRef} id="site-theme-runtime-override" />
}
