import { styleText } from 'node:util'

import type { NextRequest } from 'next/server'

import { getRequestLanguage } from '@/lib/i18n/request-locale'
import { getT } from '@/lib/i18n/server'

const insecureCookieWarnings = new Set<string>()
const warnLabel = styleText('yellow', 'warn')

function getForwardedProto(request: NextRequest): string | null {
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase()
  if (!forwardedProto) return null
  return forwardedProto
}

export function shouldUseSecureCookie(request: NextRequest): boolean {
  if (request.nextUrl.protocol === 'https:') return true
  return getForwardedProto(request) === 'https'
}

export async function resolveCookieSecureFlag(
  request: NextRequest,
  cookieName: string,
): Promise<boolean> {
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
    const { t } = await getT('auth', { lng: getRequestLanguage(request) })
    const warning = t('cookie.insecureWarning', {
      cookieName,
      host,
      protocol: request.nextUrl.protocol,
      forwardedProto,
    })
    console.warn(`${warnLabel} ${warning}`)
  }

  return false
}
