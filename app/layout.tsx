import '../styles/globals.css'

import type { Metadata } from 'next'

import { GlobalMouseTilt } from '@/components/global-mouse-tilt'
import { SiteTimezoneProvider } from '@/components/site-timezone-provider'
import { ThemeProvider } from '@/components/theme-provider'
import { DEFAULT_PAGE_TITLE, PAGE_TITLE_MAX_LEN } from '@/lib/default-page-title'
import { getSiteConfigMemoryFirst } from '@/lib/site-config-cache'
import { DEFAULT_TIMEZONE, normalizeTimezone } from '@/lib/timezone'

export async function generateMetadata(): Promise<Metadata> {
  let title = DEFAULT_PAGE_TITLE
  let searchEngineIndexingEnabled = true
  try {
    const config = await getSiteConfigMemoryFirst()
    const raw = String(config?.pageTitle ?? '').trim()
    if (raw) {
      title = raw.slice(0, PAGE_TITLE_MAX_LEN)
    }
    searchEngineIndexingEnabled = config?.searchEngineIndexingEnabled !== false
  } catch {
    // e.g. DB not ready during build or first boot
  }
  return {
    title,
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
  let globalMouseTiltEnabled = false
  let globalMouseTiltGyroEnabled = false
  let displayTimezone = DEFAULT_TIMEZONE
  let forceDisplayTimezone = false
  try {
    const row = await getSiteConfigMemoryFirst()
    globalMouseTiltEnabled = row?.globalMouseTiltEnabled === true
    globalMouseTiltGyroEnabled = row?.globalMouseTiltGyroEnabled === true
    displayTimezone = normalizeTimezone(row?.displayTimezone)
    forceDisplayTimezone = row?.forceDisplayTimezone === true
  } catch {
    // DB not ready during build or first boot
  }

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.loli.net" />
        <link rel="preconnect" href="https://gstatic.loli.net" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.loli.net/css2?family=Noto+Sans+SC:wght@300;400;500&family=Ubuntu:wght@300;400;500;700&display=swap"
        />
      </head>
      <body className="antialiased">
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
        <div id="site-footer-portal" />
      </body>
    </html>
  )
}
