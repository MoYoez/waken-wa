type AvatarImageOptions = {
  format?: 'avif' | 'jpeg' | 'png' | 'webp'
  quality?: number
  width?: number
}

function appendAvatarImageOptions(path: string, options?: AvatarImageOptions): string {
  if (!options) return path
  const params = new URLSearchParams()
  if (Number.isFinite(options.width)) params.set('w', String(Math.round(options.width as number)))
  if (Number.isFinite(options.quality)) params.set('q', String(Math.round(options.quality as number)))
  if (options.format) params.set('format', options.format)
  const query = params.toString()
  return query ? `${path}?${query}` : path
}

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

export function getAvatarProxyUrl(rawUrl: string, options?: AvatarImageOptions): string {
  const params = new URLSearchParams({ url: rawUrl })
  const width = options?.width
  const quality = options?.quality
  if (Number.isFinite(width)) params.set('w', String(Math.round(width as number)))
  if (Number.isFinite(quality)) params.set('q', String(Math.round(quality as number)))
  if (options?.format) params.set('format', options.format)
  return `/api/avatar?${params.toString()}`
}

export function getConfiguredAvatarProxyUrl(options?: AvatarImageOptions): string {
  return appendAvatarImageOptions('/api/avatar', options)
}

export function resolveAvatarUrl(
  rawUrl: unknown,
  fetchByServer?: boolean | null,
  mode: 'direct' | 'public' | 'admin-preview' = 'direct',
  options?: AvatarImageOptions,
): string {
  const normalized = typeof rawUrl === 'string' ? rawUrl.trim() : ''
  if (!normalized) return ''
  if (fetchByServer && isRemoteAvatarUrl(normalized)) {
    if (mode === 'public') return getConfiguredAvatarProxyUrl(options)
    if (mode === 'admin-preview') return getAvatarProxyUrl(normalized, options)
  }
  return normalized
}
