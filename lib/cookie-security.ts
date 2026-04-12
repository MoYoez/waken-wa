import type { NextRequest } from 'next/server'

const insecureCookieWarnings = new Set<string>()

function getForwardedProto(request: NextRequest): string | null {
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase()
  if (!forwardedProto) return null
  return forwardedProto
}

export function shouldUseSecureCookie(request: NextRequest): boolean {
  if (request.nextUrl.protocol === 'https:') return true
  return getForwardedProto(request) === 'https'
}

export function resolveCookieSecureFlag(request: NextRequest, cookieName: string): boolean {
  const secure = shouldUseSecureCookie(request)
  if (secure) return true

  const host =
    request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() ||
    request.headers.get('host') ||
    request.nextUrl.host ||
    'unknown-host'
  const warningKey = `${cookieName}:${host}`

  if (!insecureCookieWarnings.has(warningKey)) {
    insecureCookieWarnings.add(warningKey)
    const forwardedProto = getForwardedProto(request) ?? 'missing'
    console.warn(
      `[cookie] "${cookieName}" is being downgraded without Secure because the request did not resolve to HTTPS (host=${host}, nextUrl.protocol=${request.nextUrl.protocol}, x-forwarded-proto=${forwardedProto}). Use this only for local or trusted-network deployments.`,
    )
  }

  return false
}
