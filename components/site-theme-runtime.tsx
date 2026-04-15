'use client'

import { useEffect, useMemo, useRef } from 'react'

import {
  buildCustomSurfaceCss,
  isThemePaletteLiveEnabled,
  parseThemeCustomSurface,
  resolveThemePaletteLiveScope,
  resolveThemePaletteMode,
} from '@/lib/theme-custom-surface'
import { resolveThemeBackgroundImageMode } from '@/lib/theme-custom-surface'
import {
  extractThemeSurfaceFromLoadedImage,
  loadPaletteImage,
} from '@/lib/theme-image-palette'
import { loadThemeSurfaceActiveImageAsset } from '@/lib/theme-image-source'

type Props = {
  themePreset: string | null | undefined
  themeCustomSurface: unknown
}

function buildResolvedBackgroundCss(url: string) {
  return url ? `url(${JSON.stringify(url)}) center / cover no-repeat` : ''
}

export function SiteThemeRuntime({ themePreset, themeCustomSurface }: Props) {
  const parsed = useMemo(() => parseThemeCustomSurface(themeCustomSurface), [themeCustomSurface])
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
    let revokeImageUrl: (() => void) | undefined
    const abortController = new AbortController()

    void (async () => {
      let runtimeImageUrl = ''
      const liveEnabled = isThemePaletteLiveEnabled(parsed)
      const paletteMode = resolveThemePaletteMode(parsed)
      const paletteScope = resolveThemePaletteLiveScope(parsed)
      const mode = resolveThemeBackgroundImageMode(parsed)
      const shouldApplyLivePalette =
        liveEnabled &&
        paletteMode === 'liveFromImage' &&
        paletteScope === 'randomOnly' &&
        (mode === 'randomPool' || mode === 'randomApi')

      try {
        const asset = await loadThemeSurfaceActiveImageAsset(parsed, {
          signal: abortController.signal,
        })
        if (cancelled) {
          asset?.revoke?.()
          return
        }

        runtimeImageUrl = asset?.displayUrl ?? ''
        if (!runtimeImageUrl || !asset) {
          emitThemeReadyAfterPaint('')
          return
        }
        revokeImageUrl = asset.revoke

        if (!shouldApplyLivePalette) {
          emitThemeReadyAfterPaint(
            `body { background: ${buildResolvedBackgroundCss(runtimeImageUrl)}; background-position: 50% 50%; background-size: cover; background-repeat: no-repeat; }`,
          )
          return
        }

        try {
          const image = await loadPaletteImage(asset.displayUrl)
          if (cancelled) return
          const paletteTheme = extractThemeSurfaceFromLoadedImage(image, asset.seedUrl)
          if (cancelled) return
          const css = buildCustomSurfaceCss({
            ...parsed,
            ...paletteTheme,
            paletteMode: 'liveFromImage',
          })
          const bodyCss = buildResolvedBackgroundCss(runtimeImageUrl)
          emitThemeReadyAfterPaint(
            `${css}\nbody { background: ${bodyCss}; background-position: 50% 50%; background-size: cover; background-repeat: no-repeat; }`,
          )
        } catch {
          if (cancelled) return
          emitThemeReadyAfterPaint(
            `body { background: ${buildResolvedBackgroundCss(runtimeImageUrl)}; background-position: 50% 50%; background-size: cover; background-repeat: no-repeat; }`,
          )
        }
      } catch {
        if (cancelled) return
        const bodyCss = buildResolvedBackgroundCss(runtimeImageUrl)
        emitThemeReadyAfterPaint(
          bodyCss
            ? `body { background: ${bodyCss}; background-position: 50% 50%; background-size: cover; background-repeat: no-repeat; }`
            : '',
        )
      }
    })()

    return () => {
      cancelled = true
      abortController.abort()
      revokeImageUrl?.()
    }
  }, [parsed, themePreset])

  return <style ref={styleRef} id="site-theme-runtime-override" />
}
