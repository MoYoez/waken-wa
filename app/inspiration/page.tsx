import Link from 'next/link'

import { ContentReadingPanel } from '@/components/content-reading-panel'
import { InspirationArchiveList } from '@/components/inspiration-archive-list'
import { SiteReveal } from '@/components/site-reveal'
import { db } from '@/lib/db'
import { siteConfig } from '@/lib/drizzle-schema'
import { normalizeTimezone } from '@/lib/timezone'

export const dynamic = 'force-dynamic'

export default async function InspirationArchivePage() {
  const [config] = await db.select().from(siteConfig).limit(1)
  const displayTimezone = normalizeTimezone(config?.displayTimezone)

  return (
    <main className="relative min-h-screen overflow-x-hidden">
      <div className="mx-auto max-w-2xl overflow-x-hidden px-4 pt-16 pb-24 sm:px-6">
        <ContentReadingPanel className="space-y-6 p-5 sm:p-6">
          <SiteReveal delay={0.04}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-sm font-semibold text-foreground tracking-tight">随想录</h1>
              <Link href="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                ← 返回首页
              </Link>
            </div>
          </SiteReveal>
          <SiteReveal delay={0.08}>
            <p className="text-sm text-muted-foreground">向下滚动自动加载更多</p>
          </SiteReveal>
          <SiteReveal delay={0.12}>
            <InspirationArchiveList displayTimezone={displayTimezone} />
          </SiteReveal>
        </ContentReadingPanel>
      </div>
    </main>
  )
}
