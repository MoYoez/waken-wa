import './globals.css'

import { Analytics } from '@vercel/analytics/next'
import type { Metadata } from 'next'
import { Geist_Mono,Noto_Sans_SC } from 'next/font/google'

import { GlobalMouseTilt } from '@/components/global-mouse-tilt'
import { DEFAULT_PAGE_TITLE, PAGE_TITLE_MAX_LEN } from '@/lib/default-page-title'
import prisma from '@/lib/prisma'

const _notoSansSC = Noto_Sans_SC({ subsets: ["latin"], weight: ["300", "400", "500"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

const staticMetadataBase: Omit<Metadata, 'title'> = {
  description: '追踪并展示你的实时活动状态，包括设备、进程和时间信息',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export async function generateMetadata(): Promise<Metadata> {
  let title = DEFAULT_PAGE_TITLE
  try {
    const config = await (prisma as any).siteConfig.findUnique({
      where: { id: 1 },
      select: { pageTitle: true },
    })
    const raw = String(config?.pageTitle ?? '').trim()
    if (raw) {
      title = raw.slice(0, PAGE_TITLE_MAX_LEN)
    }
  } catch {
    // e.g. DB not ready during build or first boot
  }
  return { ...staticMetadataBase, title }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  let globalMouseTiltEnabled = false
  try {
    const row = await (prisma as any).siteConfig.findUnique({
      where: { id: 1 },
      select: { globalMouseTiltEnabled: true },
    })
    globalMouseTiltEnabled = row?.globalMouseTiltEnabled === true
  } catch {
    // DB not ready during build or first boot
  }

  return (
    <html lang="zh-CN">
      <body className="font-sans antialiased">
        <GlobalMouseTilt enabled={globalMouseTiltEnabled}>{children}</GlobalMouseTilt>
        <div id="site-footer-portal" />
        <Analytics />
      </body>
    </html>
  )
}
