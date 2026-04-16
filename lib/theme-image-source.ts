import { parseThemeCustomSurface, resolveThemeBackgroundImageMode, resolveThemeImagePool } from '@/lib/theme-custom-surface'
import { readThemeImageUrlFromJson } from '@/lib/theme-image-url'
import type { ThemeCustomSurfaceFields } from '@/types/theme'

export type ThemeSurfaceActiveImageTarget = {
  url: string
}

export type ThemeSurfaceResolvedImageTarget = {
  url: string
}

export type ThemeSurfaceLoadedImageAsset = {
  displayUrl: string
  seedUrl: string
  revoke?: () => void
}

export function pickRandomThemeImage(items: string[]): string {
  if (items.length < 1) return ''
  const index = Math.floor(Math.random() * items.length)
  return items[index] ?? ''
}

function toResolvedThemeImageTarget(input: string): ThemeSurfaceResolvedImageTarget | null {
  const url = String(input ?? '').trim()
  if (!url) return null
  return { url }
}

async function tryResolveRandomApiImage(
  apiUrl: string,
  options?: { signal?: AbortSignal },
): Promise<string> {
  const clean = String(apiUrl ?? '').trim()
  if (!clean) return ''

  try {
    const response = await fetch('/api/theme/random', {
      cache: 'no-store',
      signal: options?.signal,
    })
    if (!response.ok) return ''
    const json = await response.json().catch(() => null)
    const imageUrl = String(readThemeImageUrlFromJson(json?.data) ?? '').trim()
    return imageUrl
  } catch {
    return ''
  }
}

export function resolveThemeSurfaceActiveImageTarget(
  rawThemeCustomSurface: ThemeCustomSurfaceFields | unknown,
): ThemeSurfaceActiveImageTarget {
  const parsed = parseThemeCustomSurface(rawThemeCustomSurface)
  const mode = resolveThemeBackgroundImageMode(parsed)
  if (mode === 'manual') {
    return {
      url: String(parsed.backgroundImageUrl ?? '').trim(),
    }
  }

  if (mode === 'randomPool') {
    return {
      url: pickRandomThemeImage(resolveThemeImagePool(parsed)),
    }
  }

  return {
    url: '',
  }
}

export async function resolveThemeSurfaceFixedImageTarget(
  rawThemeCustomSurface: ThemeCustomSurfaceFields | unknown,
  options?: { signal?: AbortSignal },
): Promise<ThemeSurfaceResolvedImageTarget | null> {
  const parsed = parseThemeCustomSurface(rawThemeCustomSurface)
  const mode = resolveThemeBackgroundImageMode(parsed)

  if (mode === 'manual') {
    return toResolvedThemeImageTarget(String(parsed.backgroundImageUrl ?? ''))
  }

  if (mode === 'randomPool') {
    return toResolvedThemeImageTarget(pickRandomThemeImage(resolveThemeImagePool(parsed)))
  }

  const apiUrl = String(parsed.backgroundRandomApiUrl ?? '').trim()
  if (!apiUrl) return null

  const resolvedUrl = await tryResolveRandomApiImage(apiUrl, options)
  return toResolvedThemeImageTarget(resolvedUrl)
}

export function buildThemeSurfaceResolvedImageDisplayUrl(
  target: ThemeSurfaceResolvedImageTarget,
): string {
  return String(target.url ?? '').trim()
}

export async function loadThemeSurfaceActiveImageAsset(
  rawThemeCustomSurface: ThemeCustomSurfaceFields | unknown,
  options?: { signal?: AbortSignal },
): Promise<ThemeSurfaceLoadedImageAsset | null> {
  const fixedTarget = await resolveThemeSurfaceFixedImageTarget(rawThemeCustomSurface, options)
  if (fixedTarget?.url) {
    return {
      displayUrl: buildThemeSurfaceResolvedImageDisplayUrl(fixedTarget),
      seedUrl: fixedTarget.url,
    }
  }

  const target = resolveThemeSurfaceActiveImageTarget(rawThemeCustomSurface)
  if (!target.url) return null

  return {
    displayUrl: target.url,
    seedUrl: target.url,
  }
}
