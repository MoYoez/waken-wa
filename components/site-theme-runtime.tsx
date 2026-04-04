'use client'

import { useEffect, useMemo, useRef } from 'react'

import {
  buildCustomSurfaceCss,
  buildThemeImageBackgroundCss,
  isThemePaletteLiveEnabled,
  parseThemeCustomSurface,
  resolveThemePaletteLiveScope,
  resolveThemePaletteMode,
} from '@/lib/theme-custom-surface'
import { resolveThemeBackgroundImageMode } from '@/lib/theme-custom-surface'
import {
  extractThemeSurfaceFromLoadedImage,
  loadPaletteImage,
  normalizeThemePaletteImageSource,
} from '@/lib/theme-image-palette'
import { resolveThemeSurfaceActiveImage } from '@/lib/theme-image-source'

type Props = {
  themePreset: string | null | undefined
  themeCustomSurface: unknown
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

    void (async () => {
      let runtimeImageUrl = ''
      const liveEnabled = isThemePaletteLiveEnabled(parsed)
      const paletteMode = resolveThemePaletteMode(parsed)
      const paletteScope = resolveThemePaletteLiveScope(parsed)
      const mode = resolveThemeBackgroundImageMode(parsed)

      try {
        const activeImageUrl = await resolveThemeSurfaceActiveImage(parsed)
        if (cancelled) return

        runtimeImageUrl = normalizeThemePaletteImageSource(activeImageUrl)
        if (!runtimeImageUrl) {
          emitThemeReadyAfterPaint('')
          return
        }

        const image = await loadPaletteImage(runtimeImageUrl)
        if (cancelled) return

        const shouldApplyLivePalette =
          liveEnabled &&
          paletteMode === 'liveFromImage' &&
          paletteScope === 'randomOnly' &&
          (mode === 'randomPool' || mode === 'randomApi')

        if (!shouldApplyLivePalette) {
          emitThemeReadyAfterPaint(
            `body { background: ${buildThemeImageBackgroundCss(runtimeImageUrl)}; background-position: 50% 50%; background-size: cover; background-repeat: no-repeat; }`,
          )
          return
        }

        const paletteTheme = extractThemeSurfaceFromLoadedImage(image, runtimeImageUrl)
        if (cancelled) return
        const css = buildCustomSurfaceCss({
          ...parsed,
          ...paletteTheme,
          paletteMode: 'liveFromImage',
        })
        const bodyCss = buildThemeImageBackgroundCss(runtimeImageUrl)
        emitThemeReadyAfterPaint(
          `${css}\nbody { background: ${bodyCss}; background-position: 50% 50%; background-size: cover; background-repeat: no-repeat; }`,
        )
      } catch {
        if (cancelled) return
        const bodyCss = buildThemeImageBackgroundCss(runtimeImageUrl)
        emitThemeReadyAfterPaint(
          bodyCss
            ? `body { background: ${bodyCss}; background-position: 50% 50%; background-size: cover; background-repeat: no-repeat; }`
            : '',
        )
      }
    })()

    return () => {
      cancelled = true
    }
  }, [parsed, themePreset])

  return <style ref={styleRef} id="site-theme-runtime-override" />
}
