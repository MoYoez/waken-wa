import { parseThemeCustomSurface, resolveThemeBackgroundImageMode, resolveThemeImagePool } from '@/lib/theme-custom-surface'
import type { ThemeCustomSurfaceFields } from '@/types/theme'

export function pickRandomThemeImage(items: string[]): string {
  if (items.length < 1) return ''
  const index = Math.floor(Math.random() * items.length)
  return items[index] ?? ''
}

function readImageUrlFromJson(value: unknown): string {
  if (!value || typeof value !== 'object') return ''
  const row = value as Record<string, unknown>
  for (const key of ['url', 'image', 'imageUrl', 'src', 'download_url']) {
    const candidate = String(row[key] ?? '').trim()
    if (candidate) return candidate
  }
  const urls = row.urls
  if (urls && typeof urls === 'object') {
    const nested = urls as Record<string, unknown>
    for (const key of ['regular', 'full', 'raw', 'small']) {
      const candidate = String(nested[key] ?? '').trim()
      if (candidate) return candidate
    }
  }
  const data = row.data
  if (data && typeof data === 'object') return readImageUrlFromJson(data)
  return ''
}

export async function resolveRandomApiImage(apiUrl: string): Promise<string> {
  const clean = String(apiUrl ?? '').trim()
  if (!clean) return ''

  try {
    const response = await fetch(clean, {
      cache: 'no-store',
      headers: {
        Accept: 'application/json,image/*;q=0.9,*/*;q=0.8',
      },
    })
    if (!response.ok) return clean
    const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
    if (contentType.startsWith('image/')) {
      return response.url || clean
    }
    if (contentType.includes('application/json')) {
      const json = await response.json().catch(() => null)
      return readImageUrlFromJson(json) || clean
    }
    return response.url || clean
  } catch {
    return clean
  }
}

export async function resolveThemeSurfaceActiveImage(
  rawThemeCustomSurface: ThemeCustomSurfaceFields | unknown,
): Promise<string> {
  const parsed = parseThemeCustomSurface(rawThemeCustomSurface)
  const mode = resolveThemeBackgroundImageMode(parsed)
  if (mode === 'manual') {
    return String(parsed.backgroundImageUrl ?? '').trim()
  }
  if (mode === 'randomPool') {
    return pickRandomThemeImage(resolveThemeImagePool(parsed))
  }
  return resolveRandomApiImage(String(parsed.backgroundRandomApiUrl ?? ''))
}
