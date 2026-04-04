import '../styles/globals.css'

import type { Metadata } from 'next'
import { Noto_Sans_SC, Ubuntu } from 'next/font/google'

import { GlobalMouseTilt } from '@/components/global-mouse-tilt'
import { ThemeProvider } from '@/components/theme-provider'
import { DEFAULT_PAGE_TITLE, PAGE_TITLE_MAX_LEN } from '@/lib/default-page-title'
import { getSiteConfigMemoryFirst } from '@/lib/site-config-cache'

const notoSansSC = Noto_Sans_SC({
  subsets: ['latin'],
  variable: '--font-noto-sans-sc',
  weight: ['300', '400', '500'],
})
const ubuntu = Ubuntu({
  subsets: ['latin'],
  variable: '--font-ubuntu',
  weight: ['300', '400', '500', '700'],
})

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
  try {
    const row = await getSiteConfigMemoryFirst()
    globalMouseTiltEnabled = row?.globalMouseTiltEnabled === true
    globalMouseTiltGyroEnabled = row?.globalMouseTiltGyroEnabled === true
  } catch {
    // DB not ready during build or first boot
  }

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className={`${notoSansSC.variable} ${ubuntu.variable} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <GlobalMouseTilt enabled={globalMouseTiltEnabled} gyroEnabled={globalMouseTiltGyroEnabled}>
            {children}
          </GlobalMouseTilt>
        </ThemeProvider>
        <div id="site-footer-portal" />
      </body>
    </html>
  )
}
