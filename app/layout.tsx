import 'lenis/dist/lenis.css'
import '../styles/globals.css'

import type { Metadata } from 'next'
import { cookies, headers } from 'next/headers'
import { I18nProvider } from 'next-i18next/client'

import { GlobalMouseTilt } from '@/components/global-mouse-tilt'
import { SiteTimezoneProvider } from '@/components/site-timezone-provider'
import { ThemeProvider } from '@/components/theme-provider'
import i18nConfig, { type AppLanguage } from '@/i18n.config'
import { DEFAULT_PAGE_TITLE, PAGE_TITLE_MAX_LEN } from '@/lib/default-page-title'
import {
  I18N_LANGUAGE_HEADER_NAME,
  NEXT_LOCALE_COOKIE_NAME,
  normalizeRequestLanguage,
} from '@/lib/i18n/request-locale'
import { getLayoutResources } from '@/lib/i18n/server'
import {
  buildPublicPageFontRuntime,
  coercePublicPageFontPreferenceToOptions,
  parsePublicPageFontCookie,
  PUBLIC_PAGE_FONT_COOKIE_NAME,
  PUBLIC_PAGE_FONT_STYLE_ELEMENT_ID,
  PUBLIC_PAGE_FONT_STYLESHEET_ELEMENT_ID,
  resolvePublicPageControlFontOptions,
} from '@/lib/public-page-font'
import { getSiteConfigMemoryFirst } from '@/lib/site-config-cache'
import { buildSiteIconHref } from '@/lib/site-icon'
import { normalizeThemeMode, THEME_COOKIE_NAME, THEME_STORAGE_KEY } from '@/lib/theme'
import { DEFAULT_TIMEZONE, normalizeTimezone } from '@/lib/timezone'

export async function generateMetadata(): Promise<Metadata> {
  let title = DEFAULT_PAGE_TITLE
  let searchEngineIndexingEnabled = true
  let siteIconHref = buildSiteIconHref()
  try {
    const config = await getSiteConfigMemoryFirst()
    const raw = String(config?.pageTitle ?? '').trim()
    if (raw) {
      title = raw.slice(0, PAGE_TITLE_MAX_LEN)
    }
    searchEngineIndexingEnabled = config?.searchEngineIndexingEnabled !== false
    siteIconHref = buildSiteIconHref(config?.updatedAt)
  } catch {
    // e.g. DB not ready during build or first boot
  }
  return {
    title,
    icons: {
      icon: siteIconHref,
      shortcut: siteIconHref,
      apple: siteIconHref,
    },
    robots: searchEngineIndexingEnabled
      ? {
          index: true,
          follow: true,
        }
      : {
          index: false,
          follow: false,
          nocache: true,
          googleBot: {
            index: false,
            follow: false,
            noimageindex: true,
          },
        },
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const headerStore = await headers()
  const cookieStore = await cookies()
  const fallbackLng = i18nConfig.fallbackLng as AppLanguage
  const lng: AppLanguage =
    normalizeRequestLanguage(headerStore.get(I18N_LANGUAGE_HEADER_NAME)) ??
    normalizeRequestLanguage(cookieStore.get(NEXT_LOCALE_COOKIE_NAME)?.value) ??
    fallbackLng
  const resources = await getLayoutResources(lng)
  const persistedTheme = normalizeThemeMode(cookieStore.get(THEME_COOKIE_NAME)?.value)
  const htmlStyle =
    persistedTheme === 'light' || persistedTheme === 'dark'
      ? { colorScheme: persistedTheme }
      : undefined

  let globalMouseTiltEnabled = false
  let globalMouseTiltGyroEnabled = false
  let displayTimezone = DEFAULT_TIMEZONE
  let forceDisplayTimezone = false
  let publicFontOptions = resolvePublicPageControlFontOptions(false, null)
  try {
    const row = await getSiteConfigMemoryFirst()
    globalMouseTiltEnabled = row?.globalMouseTiltEnabled === true
    globalMouseTiltGyroEnabled = row?.globalMouseTiltGyroEnabled === true
    displayTimezone = normalizeTimezone(row?.displayTimezone)
    forceDisplayTimezone = row?.forceDisplayTimezone === true
    publicFontOptions = resolvePublicPageControlFontOptions(
      row?.publicFontOptionsEnabled,
      row?.publicFontOptions,
    )
  } catch {
    // DB not ready during build or first boot
  }
  const publicPageFontRuntime = buildPublicPageFontRuntime(
    coercePublicPageFontPreferenceToOptions(
      parsePublicPageFontCookie(cookieStore.get(PUBLIC_PAGE_FONT_COOKIE_NAME)?.value),
      publicFontOptions,
    ),
  )
  const htmlClassName = persistedTheme === 'dark' ? 'dark' : undefined
  const themeBootstrapScript = `
;(() => {
  const root = document.documentElement
  const storageKey = ${JSON.stringify(THEME_STORAGE_KEY)}
  const cookieName = ${JSON.stringify(THEME_COOKIE_NAME)}
  const fallbackTheme = 'system'

  const readCookieTheme = () => {
    const cookieItem = document.cookie
      .split(';')
      .map((item) => item.trim())
      .find((item) => item.startsWith(cookieName + '='))
    return cookieItem ? cookieItem.slice(cookieName.length + 1) : ''
  }

  let theme = fallbackTheme
  try {
    theme = localStorage.getItem(storageKey) || readCookieTheme() || fallbackTheme
  } catch {
    theme = readCookieTheme() || fallbackTheme
  }

  const resolvedTheme =
    theme === 'dark'
      ? 'dark'
      : theme === 'light'
        ? 'light'
        : window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'

  root.classList.toggle('dark', resolvedTheme === 'dark')
  root.style.colorScheme = resolvedTheme
})()
`.trim()

  return (
    <html lang={lng} suppressHydrationWarning className={htmlClassName} style={htmlStyle}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
        <link rel="preconnect" href="https://fonts.loli.net" />
        <link rel="preconnect" href="https://gstatic.loli.net" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.loli.net/css2?family=Noto+Sans+SC:wght@300;400;500&family=Satisfy&family=Ubuntu:wght@300;400;500;700&display=swap"
        />
        {publicPageFontRuntime.stylesheetHref ? (
          <link
            id={PUBLIC_PAGE_FONT_STYLESHEET_ELEMENT_ID}
            rel="stylesheet"
            href={publicPageFontRuntime.stylesheetHref}
          />
        ) : null}
        <style id={PUBLIC_PAGE_FONT_STYLE_ELEMENT_ID}>{publicPageFontRuntime.cssText}</style>
      </head>
      <body className="antialiased">
        <div id="site-theme-image-layer" aria-hidden />
        <I18nProvider
          key={lng}
          language={lng}
          resources={resources}
          supportedLngs={i18nConfig.supportedLngs}
          defaultNS={i18nConfig.defaultNS}
          fallbackLng={i18nConfig.fallbackLng}
        >
          <SiteTimezoneProvider
            displayTimezone={displayTimezone}
            forceDisplayTimezone={forceDisplayTimezone}
          >
            <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
              <GlobalMouseTilt enabled={globalMouseTiltEnabled} gyroEnabled={globalMouseTiltGyroEnabled}>
                {children}
              </GlobalMouseTilt>
            </ThemeProvider>
          </SiteTimezoneProvider>
        </I18nProvider>
        <div id="site-footer-portal" />
      </body>
    </html>
  )
}
