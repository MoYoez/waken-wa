import { type NextRequest, NextResponse } from 'next/server'

import { isRateLimited } from '@/lib/rate-limit'

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_AUTH = 10

const RATE_LIMITED_PATHS = new Set([
  '/api/auth/login',
  '/api/site/unlock',
  '/api/admin/change-password',
])

const ADMIN_API_PREFIX = '/api/admin/'
const ADMIN_SETUP_PREFIX = '/api/admin/setup'

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  )
}

function addSecurityHeaders(response: NextResponse): NextResponse {
  const cspDirectives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV !== 'production' ? " 'unsafe-eval'" : ''}`,
    "connect-src 'self' https: wss: ws:",
  ]
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Content-Security-Policy', cspDirectives.join('; '))
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()',
  )
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains',
    )
  }
  return response
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (RATE_LIMITED_PATHS.has(pathname) && request.method === 'POST') {
    const ip = getClientIp(request)
    if (
      await isRateLimited(`rl:${pathname}:${ip}`, RATE_LIMIT_MAX_AUTH, RATE_LIMIT_WINDOW_MS)
    ) {
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: '请求过于频繁，请稍后再试' },
          { status: 429 },
        ),
      )
    }
  }

  // Defense-in-depth: reject admin API calls that lack a session cookie.
  // The actual JWT verification still happens inside each route handler.
  if (
    pathname.startsWith(ADMIN_API_PREFIX) &&
    !pathname.startsWith(ADMIN_SETUP_PREFIX)
  ) {
    const sessionCookie = request.cookies.get('session')
    if (!sessionCookie?.value) {
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: '未授权' },
          { status: 401 },
        ),
      )
    }
  }

  return addSecurityHeaders(NextResponse.next())
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
}
