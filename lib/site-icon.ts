export const SITE_ICON_URL_MAX_LEN = 4096

export function normalizeSiteIconUrl(raw: unknown): string | null {
  const value = typeof raw === 'string' ? raw.trim() : ''
  if (!value) return null
  return value.slice(0, SITE_ICON_URL_MAX_LEN)
}
