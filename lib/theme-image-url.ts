const THEME_IMAGE_JSON_DIRECT_KEYS = ['url', 'image', 'imageUrl', 'src', 'download_url'] as const
const THEME_IMAGE_JSON_NESTED_KEYS = ['regular', 'full', 'raw', 'small'] as const

export function readThemeImageUrlFromJson(value: unknown): string {
  if (!value || typeof value !== 'object') return ''

  const row = value as Record<string, unknown>
  for (const key of THEME_IMAGE_JSON_DIRECT_KEYS) {
    const candidate = String(row[key] ?? '').trim()
    if (candidate) return candidate
  }

  const urls = row.urls
  if (urls && typeof urls === 'object') {
    const nested = urls as Record<string, unknown>
    for (const key of THEME_IMAGE_JSON_NESTED_KEYS) {
      const candidate = String(nested[key] ?? '').trim()
      if (candidate) return candidate
    }
  }

  const data = row.data
  if (data && typeof data === 'object') {
    return readThemeImageUrlFromJson(data)
  }

  return ''
}
