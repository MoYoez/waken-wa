export function isRemoteAvatarUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  if (!trimmed) return false
  try {
    const url = new URL(trimmed)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function getAvatarProxyUrl(rawUrl: string): string {
  return `/api/avatar?url=${encodeURIComponent(rawUrl)}`
}

export function getConfiguredAvatarProxyUrl(): string {
  return '/api/avatar'
}

export function resolveAvatarUrl(
  rawUrl: unknown,
  fetchByServer?: boolean | null,
  mode: 'direct' | 'public' | 'admin-preview' = 'direct',
): string {
  const normalized = typeof rawUrl === 'string' ? rawUrl.trim() : ''
  if (!normalized) return ''
  if (fetchByServer && isRemoteAvatarUrl(normalized)) {
    if (mode === 'public') return getConfiguredAvatarProxyUrl()
    if (mode === 'admin-preview') return getAvatarProxyUrl(normalized)
  }
  return normalized
}
