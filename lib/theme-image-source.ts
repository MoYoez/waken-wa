import { parseThemeCustomSurface, resolveThemeBackgroundImageMode, resolveThemeImagePool } from '@/lib/theme-custom-surface'
import { readThemeImageUrlFromJson } from '@/lib/theme-image-url'
import type { ThemeCustomSurfaceFields } from '@/types/theme'

export type ThemeImageProxyResolver = 'direct' | 'randomApi'

export type ThemeSurfaceActiveImageTarget = {
  url: string
  resolver: ThemeImageProxyResolver | null
}

export type ThemeSurfaceResolvedImageTarget = {
  url: string
  resolver: 'direct' | null
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

function isRemoteHttpUrl(raw: string): boolean {
  return /^https?:\/\//i.test(raw.trim())
}

function toResolvedThemeImageTarget(input: string): ThemeSurfaceResolvedImageTarget | null {
  const url = String(input ?? '').trim()
  if (!url) return null
  return {
    url,
    resolver: isRemoteHttpUrl(url) ? 'direct' : null,
  }
}

export function buildThemeImageProxyUrl(
  input: string,
  resolver: ThemeImageProxyResolver = 'direct',
): string {
  const clean = String(input ?? '').trim()
  if (!clean) return ''
  const params = new URLSearchParams({ url: clean })
  if (resolver === 'randomApi') {
    params.set('resolver', 'randomApi')
  }
  return `/api/theme/image?${params.toString()}`
}

async function tryResolveRandomApiImage(
  apiUrl: string,
  options?: { signal?: AbortSignal },
): Promise<string> {
  const clean = String(apiUrl ?? '').trim()
  if (!clean) return ''

  try {
    const response = await fetch(`/api/theme/random?url=${encodeURIComponent(clean)}`, {
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
    const url = String(parsed.backgroundImageUrl ?? '').trim()
    return {
      url,
      resolver: isRemoteHttpUrl(url) ? 'direct' : null,
    }
  }

  if (mode === 'randomPool') {
    const url = pickRandomThemeImage(resolveThemeImagePool(parsed))
    return {
      url,
      resolver: isRemoteHttpUrl(url) ? 'direct' : null,
    }
  }

  const url = String(parsed.backgroundRandomApiUrl ?? '').trim()
  return {
    url,
    resolver: url ? 'randomApi' : null,
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
  if (!target.url) return ''
  return target.resolver ? buildThemeImageProxyUrl(target.url, 'direct') : target.url
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
    displayUrl: target.resolver ? buildThemeImageProxyUrl(target.url, target.resolver) : target.url,
    seedUrl: target.url,
  }
}
