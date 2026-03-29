import type { NextRequest } from 'next/server'

/**
 * Public site origin as seen by the browser (e.g. https://example.com).
 * Prefer reverse-proxy headers when set; otherwise fall back to the request URL.
 * Set PUBLIC_APP_URL (no trailing slash) if your proxy does not forward Host/proto.
 */
export function getPublicOrigin(request: NextRequest): string {
  const fromEnv = process.env.PUBLIC_APP_URL?.trim().replace(/\/+$/, '')
  if (fromEnv) {
    return fromEnv
  }

  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
  const host = forwardedHost || request.headers.get('host') || request.nextUrl.host
  if (!host) {
    return `${request.nextUrl.protocol}//${request.nextUrl.host}`.replace(/\/+$/, '')
  }

  let proto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase()
  if (proto !== 'http' && proto !== 'https') {
    proto =
      process.env.NODE_ENV === 'production'
        ? 'https'
        : request.nextUrl.protocol.replace(':', '') || 'http'
  }

  return `${proto}://${host}`
}

/** Admin URL to review a pending device; login flow preserves ?next=… */
export function buildDeviceApprovalUrl(request: NextRequest, generatedHashKey: string): string {
  const origin = getPublicOrigin(request)
  const path = `/admin?tab=devices&hash=${encodeURIComponent(generatedHashKey)}`
  return `${origin}${path}`
}
