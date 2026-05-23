export const INSPIRATION_THUMBNAIL_IMAGE_OPTIONS = {
  fit: 'cover',
  format: 'webp',
  height: 180,
  quality: 60,
  width: 180,
} as const

type InspirationImageClientOptions = {
  fit?: 'contain' | 'cover' | 'fill' | 'inside' | 'outside'
  format?: 'avif' | 'jpeg' | 'png' | 'webp'
  height?: number
  quality?: number
  width?: number
}

function AppendImageTransformParams(
  src: string,
  options: InspirationImageClientOptions,
): string {
  const hashIndex = src.indexOf('#')
  const hash = hashIndex >= 0 ? src.slice(hashIndex) : ''
  const withoutHash = hashIndex >= 0 ? src.slice(0, hashIndex) : src
  const queryIndex = withoutHash.indexOf('?')
  const path = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash
  const params = new URLSearchParams(queryIndex >= 0 ? withoutHash.slice(queryIndex + 1) : '')
  if (Number.isFinite(options.width)) params.set('w', String(Math.round(options.width as number)))
  if (Number.isFinite(options.height)) params.set('h', String(Math.round(options.height as number)))
  if (Number.isFinite(options.quality)) params.set('q', String(Math.round(options.quality as number)))
  if (options.format) params.set('format', options.format)
  if (options.fit) params.set('fit', options.fit)
  const query = params.toString()
  return query ? `${path}?${query}${hash}` : `${path}${hash}`
}

export function WithInspirationImageTransform(
  src: string,
  options: InspirationImageClientOptions = INSPIRATION_THUMBNAIL_IMAGE_OPTIONS,
): string {
  const trimmed = src.trim()
  if (
    !trimmed.startsWith('/api/inspiration/entry-img/') &&
    !trimmed.startsWith('/api/inspiration/img/')
  ) {
    return src
  }
  return AppendImageTransformParams(trimmed, options)
}
