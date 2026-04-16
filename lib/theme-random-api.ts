import 'server-only'

import { getSiteConfigMemoryFirst } from '@/lib/site-config-cache'
import {
  parseThemeCustomSurface,
  resolveThemeBackgroundImageMode,
} from '@/lib/theme-custom-surface'
import { readThemeImageUrlFromJson } from '@/lib/theme-image-url'

export function isAllowedThemeRemoteImageUrl(raw: string): boolean {
  try {
    const url = new URL(raw)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export async function getConfiguredThemeRandomApiUrl(): Promise<string> {
  const config = await getSiteConfigMemoryFirst()
  if (config?.themePreset !== 'customSurface') return ''

  const parsed = parseThemeCustomSurface(config.themeCustomSurface)
  if (resolveThemeBackgroundImageMode(parsed) !== 'randomApi') return ''

  return String(parsed.backgroundRandomApiUrl ?? '').trim()
}

export async function resolveConfiguredThemeRandomImageUrl(): Promise<string> {
  const rawUrl = await getConfiguredThemeRandomApiUrl()
  if (!rawUrl || !isAllowedThemeRemoteImageUrl(rawUrl)) {
    throw new Error('Random api is not configured')
  }

  const upstream = await fetch(rawUrl, {
    method: 'GET',
    redirect: 'follow',
    cache: 'no-store',
    headers: {
      Accept: 'application/json,image/*;q=0.9,*/*;q=0.8',
      'User-Agent': 'Mozilla/5.0 (compatible; WakenThemeRandomApiProxy/1.0)',
    },
  })

  if (!upstream.ok) {
    throw new Error(`Upstream random api failed (${upstream.status})`)
  }

  const contentType = upstream.headers.get('content-type')?.toLowerCase() ?? ''
  if (contentType.startsWith('image/')) {
    return upstream.url || rawUrl
  }

  if (contentType.includes('application/json')) {
    const json = await upstream.json().catch(() => null)
    const imageUrl = readThemeImageUrlFromJson(json)
    if (!imageUrl || !isAllowedThemeRemoteImageUrl(imageUrl)) {
      throw new Error('Random api did not return a valid image url')
    }
    return imageUrl
  }

  return upstream.url || rawUrl
}
