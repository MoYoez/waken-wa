export const SITE_ICON_REMOTE_URL_MAX_LEN = 4096
export const SITE_ICON_DATA_URL_MAX_LEN = 2_000_000
export const SITE_ICON_API_PATH = '/api/site/icon'

export function normalizeSiteIconUrl(raw: unknown): string | null {
  const value = typeof raw === 'string' ? raw.trim() : ''
  if (!value) return null
  return value.slice(
    0,
    isDataSiteIconUrl(value) ? SITE_ICON_DATA_URL_MAX_LEN : SITE_ICON_REMOTE_URL_MAX_LEN,
  )
}

export function isDataSiteIconUrl(raw: string): boolean {
  return /^data:image\//i.test(raw)
}

export function isRemoteSiteIconUrl(raw: string): boolean {
  return /^https?:\/\//i.test(raw)
}

export function buildSiteIconHref(version?: unknown): string {
  const value =
    version instanceof Date
      ? version.getTime()
      : typeof version === 'string'
        ? Date.parse(version)
        : typeof version === 'number'
          ? version
          : NaN

  if (!Number.isFinite(value) || value <= 0) {
    return SITE_ICON_API_PATH
  }

  return `${SITE_ICON_API_PATH}?v=${Math.trunc(value)}`
}
