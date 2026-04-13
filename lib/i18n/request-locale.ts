import type { NextRequest } from 'next/server'

import i18nConfig, { type AppLanguage, DEFAULT_LANGUAGE } from '@/i18n.config'

export const ADMIN_LANGUAGE_COOKIE_NAME = 'admin_Language'
export const LEGACY_ADMIN_LANGUAGE_COOKIE_NAME = 'admin_language'
export const NEXT_LOCALE_COOKIE_NAME = 'NEXT_LOCALE'
export const PUBLIC_LANGUAGE_QUERY_PARAM_NAME = 'la'
export const I18N_LANGUAGE_HEADER_NAME =
  i18nConfig.headerName || 'x-i18next-current-language'

export function normalizeRequestLanguage(input: string | null | undefined): AppLanguage | null {
  const normalized = String(input ?? '').trim().toLowerCase()
  if (!normalized) return null
  if (normalized === 'en' || normalized.startsWith('en-')) return 'en'
  if (normalized === 'zh' || normalized.startsWith('zh-')) return 'zh-CN'
  return null
}

export function getLanguageFromAcceptLanguageOrNull(
  header: string | null | undefined,
): AppLanguage | null {
  if (!header) return null

  for (const part of header.split(',')) {
    const language = normalizeRequestLanguage(part.split(';')[0]?.trim())
    if (language) return language
  }

  return null
}

export function getLanguageFromAcceptLanguage(header: string | null | undefined): AppLanguage {
  return getLanguageFromAcceptLanguageOrNull(header) ?? DEFAULT_LANGUAGE
}

export function getLocaleLanguageFromCookie(
  cookieValue: string | null | undefined,
): AppLanguage | null {
  return normalizeRequestLanguage(cookieValue)
}

export function getLanguageFromQueryParam(
  queryValue: string | null | undefined,
): AppLanguage | null {
  return normalizeRequestLanguage(queryValue)
}

export function getAdminLanguageFromCookie(
  cookieValue: string | null | undefined,
  legacyCookieValue?: string | null | undefined,
): AppLanguage | null {
  return (
    getLocaleLanguageFromCookie(cookieValue) ?? getLocaleLanguageFromCookie(legacyCookieValue)
  )
}

export function shouldUseAdminLanguage(pathname: string): boolean {
  return (
    pathname === '/admin' ||
    pathname.startsWith('/admin/') ||
    pathname.startsWith('/api/admin/') ||
    pathname.startsWith('/api/auth/')
  )
}

export function getRequestLanguage(
  request: Pick<NextRequest, 'headers' | 'cookies' | 'nextUrl'>,
): AppLanguage {
  const fromQuery = getLanguageFromQueryParam(
    request.nextUrl.searchParams.get(PUBLIC_LANGUAGE_QUERY_PARAM_NAME),
  )
  if (fromQuery) return fromQuery

  const fromHeader = normalizeRequestLanguage(request.headers.get(I18N_LANGUAGE_HEADER_NAME))
  if (fromHeader) return fromHeader

  const fromLocaleCookie = getLocaleLanguageFromCookie(
    request.cookies.get(NEXT_LOCALE_COOKIE_NAME)?.value,
  )
  if (fromLocaleCookie) return fromLocaleCookie

  return getLanguageFromAcceptLanguage(request.headers.get('accept-language'))
}
