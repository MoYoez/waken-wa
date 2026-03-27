import Link from 'next/link'
import { InspirationArchiveList } from '@/components/inspiration-archive-list'
import { ContentReadingPanel } from '@/components/content-reading-panel'

export const dynamic = 'force-dynamic'

export default function InspirationArchivePage() {
  return (
    <main className="min-h-screen relative">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-16 pb-24">
        <ContentReadingPanel className="space-y-6 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-sm font-semibold text-foreground tracking-tight">随想录</h1>
            <Link href="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              ← 返回首页
            </Link>
          </div>
          <p className="text-sm text-muted-foreground">向下滚动自动加载更多</p>
          <InspirationArchiveList />
        </ContentReadingPanel>
      </div>
    </main>
  )
}
