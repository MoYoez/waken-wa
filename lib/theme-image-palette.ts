import { getColorsFromImageData, getPaletteFromImageData } from 'colorlip/canvas'

import { resolveThemeImageRuntimeUrl } from '@/lib/theme-custom-surface'
import {
  buildThemePaletteStats,
  buildThemeSurfaceFromPalette,
  COLORLIP_EXTRACT_OPTIONS,
  type PaletteStats,
} from '@/lib/theme-image-palette-core'
import type { ThemeCustomSurfaceFields } from '@/types/theme'

type LoadPaletteImageOptions = {
  signal?: AbortSignal
  waitForDecode?: boolean
}

export type ThemePaletteExtractionAdapter = 'auto' | 'sharp' | 'canvas'

export type ThemePaletteImageAsset = {
  displayUrl: string
  seedUrl: string
  image?: HTMLImageElement | null
}

type ThemePaletteExtractionOptions = {
  signal?: AbortSignal
  adapter?: ThemePaletteExtractionAdapter
}

export function normalizeThemePaletteImageSource(input: string): string {
  const direct = String(input ?? '').trim()
  if (/^blob:/i.test(direct)) {
    return direct
  }
  return resolveThemeImageRuntimeUrl(input)
}

function createAbortError(): Error {
  if (typeof DOMException !== 'undefined') {
    return new DOMException('The operation was aborted.', 'AbortError')
  }
  const error = new Error('The operation was aborted.') as Error & { name: string }
  error.name = 'AbortError'
  return error
}

export async function loadPaletteImage(
  src: string,
  options?: LoadPaletteImageOptions,
): Promise<HTMLImageElement> {
  const clean = normalizeThemePaletteImageSource(src)
  if (!clean) {
    throw new Error('Missing image source')
  }
  if (options?.signal?.aborted) {
    throw createAbortError()
  }

  const image = new Image()
  image.decoding = 'async'
  if (/^(https?:)?\/\//i.test(clean)) {
    image.crossOrigin = 'anonymous'
  }

  await new Promise<void>((resolve, reject) => {
    let settled = false

    const cleanup = () => {
      image.onload = null
      image.onerror = null
      options?.signal?.removeEventListener('abort', onAbort)
    }

    const finish = (cb: () => void) => {
      if (settled) return
      settled = true
      cleanup()
      cb()
    }

    const onAbort = () => {
      try {
        image.src = ''
      } catch {
        // no-op
      }
      finish(() => reject(createAbortError()))
    }

    const onLoad = () => {
      if (options?.waitForDecode === false || typeof image.decode !== 'function') {
        finish(resolve)
        return
      }

      void image
        .decode()
        .catch(() => undefined)
        .finally(() => finish(resolve))
    }

    image.onload = onLoad
    image.onerror = () => finish(() => reject(new Error('Image load failed')))
    options?.signal?.addEventListener('abort', onAbort, { once: true })
    image.src = clean

    if (image.complete && image.naturalWidth > 0) {
      onLoad()
    }
  })

  return image
}

export function analyzePaletteImage(image: HTMLImageElement): PaletteStats {
  const maxSize = 150
  const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight))
  const width = Math.max(1, Math.round(image.naturalWidth * scale))
  const height = Math.max(1, Math.round(image.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) {
    throw new Error('Canvas unavailable')
  }

  canvas.width = width
  canvas.height = height
  ctx.drawImage(image, 0, 0, width, height)

  const imageData = ctx.getImageData(0, 0, width, height)
  const colors = getColorsFromImageData(imageData, COLORLIP_EXTRACT_OPTIONS)
  const palette = getPaletteFromImageData(imageData, COLORLIP_EXTRACT_OPTIONS)
  return buildThemePaletteStats(colors, palette)
}

export async function extractImagePalette(src: string): Promise<PaletteStats> {
  const image = await loadPaletteImage(src)
  return analyzePaletteImage(image)
}

export function extractThemeSurfaceFromLoadedImage(
  image: HTMLImageElement,
  seedImageUrl: string,
): Partial<ThemeCustomSurfaceFields> {
  const clean = normalizeThemePaletteImageSource(seedImageUrl)
  const palette = analyzePaletteImage(image)
  return buildThemeSurfaceFromPalette(palette, clean)
}

function shouldUseCanvasAdapter(asset: ThemePaletteImageAsset): boolean {
  const displayUrl = String(asset.displayUrl ?? '').trim()
  if (!displayUrl) return true
  if (/^(blob|data):/i.test(displayUrl)) return true
  if (/^https?:\/\//i.test(displayUrl)) return true
  if (displayUrl.startsWith('./') || displayUrl.startsWith('../')) return true
  return false
}

function resolveThemePaletteExtractionAdapter(
  asset: ThemePaletteImageAsset,
  adapter: ThemePaletteExtractionAdapter = 'auto',
): 'sharp' | 'canvas' {
  if (adapter === 'sharp' || adapter === 'canvas') {
    return adapter
  }
  return shouldUseCanvasAdapter(asset) ? 'canvas' : 'sharp'
}

async function extractThemeSurfaceFromServer(
  asset: ThemePaletteImageAsset,
  options?: ThemePaletteExtractionOptions,
): Promise<Partial<ThemeCustomSurfaceFields>> {
  const response = await fetch('/api/theme/palette', {
    method: 'POST',
    cache: 'no-store',
    signal: options?.signal,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      displayUrl: asset.displayUrl,
      seedUrl: asset.seedUrl,
    }),
  })

  if (!response.ok) {
    throw new Error(`Theme palette request failed (${response.status})`)
  }

  const json = await response.json().catch(() => null)
  const theme = json?.data?.theme
  if (!theme || typeof theme !== 'object' || Array.isArray(theme)) {
    throw new Error('Theme palette response is invalid')
  }

  return theme as Partial<ThemeCustomSurfaceFields>
}

export async function extractThemeSurfaceFromImageAsset(
  asset: ThemePaletteImageAsset,
  options?: ThemePaletteExtractionOptions,
): Promise<Partial<ThemeCustomSurfaceFields>> {
  const requestedAdapter = options?.adapter ?? 'auto'
  const resolvedAdapter = resolveThemePaletteExtractionAdapter(asset, requestedAdapter)

  if (resolvedAdapter === 'sharp') {
    try {
      return await extractThemeSurfaceFromServer(asset, options)
    } catch (error) {
      if (requestedAdapter === 'sharp') {
        throw error
      }
    }
  }

  const image =
    asset.image ??
    (await loadPaletteImage(asset.displayUrl, {
      signal: options?.signal,
    }))

  return extractThemeSurfaceFromLoadedImage(image, asset.seedUrl)
}
