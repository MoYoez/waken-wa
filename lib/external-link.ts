const SAFE_ABSOLUTE_PROTOCOLS = new Set(['http:', 'https:'])

function normalizeRawUrl(raw: string): string {
  return raw.trim()
}

export function isSafeRelativeUrl(raw: string): boolean {
  const value = normalizeRawUrl(raw)
  if (!value) return false
  if (value.startsWith('//')) return false
  return value.startsWith('/') || value.startsWith('./') || value.startsWith('../') || value.startsWith('#')
}

export function normalizeSafeAbsoluteUrl(raw: string): string | null {
  const value = normalizeRawUrl(raw)
  if (!value) return null

  try {
    const parsed = new URL(value)
    if (!SAFE_ABSOLUTE_PROTOCOLS.has(parsed.protocol)) {
      return null
    }
    return parsed.toString()
  } catch {
    return null
  }
}

export function getSafeUserFacingHref(raw: string): string {
  if (isSafeRelativeUrl(raw)) {
    return normalizeRawUrl(raw)
  }

  const absolute = normalizeSafeAbsoluteUrl(raw)
  if (!absolute) {
    return '#'
  }

  return `/outbound?target=${encodeURIComponent(absolute)}`
}

export function getOutboundTarget(raw: string): string | null {
  return normalizeSafeAbsoluteUrl(raw)
}

