import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { MarkdownContent } from '@/components/admin/markdown-content'
import { ContentReadingPanel } from '@/components/content-reading-panel'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: raw } = await params
  const id = parseInt(raw, 10)
  if (!Number.isFinite(id)) return { title: '随想录' }

  const row = await (prisma as any).inspirationEntry.findUnique({
    where: { id },
    select: { title: true },
  })
  const t = row?.title?.trim()
  return { title: t ? `${t} · 随想录` : '随想录' }
}

export default async function InspirationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: raw } = await params
  const id = parseInt(raw, 10)
  if (!Number.isFinite(id)) notFound()

  const row = await (prisma as any).inspirationEntry.findUnique({
    where: { id },
  })
  if (!row) notFound()

  const createdAt = row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt)

  return (
    <main className="min-h-screen relative">
      <article className="max-w-2xl mx-auto px-4 sm:px-6 pt-16 pb-24">
        <ContentReadingPanel className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground mb-8">
            <Link href="/" className="hover:text-foreground transition-colors">
              ← 首页
            </Link>
            <Link href="/inspiration" className="hover:text-foreground transition-colors">
              全部随想录
            </Link>
          </div>

          {row.imageDataUrl ? (
            <div className="mb-6 rounded-md overflow-hidden border border-border bg-muted/30">
              <img
                src={row.imageDataUrl}
                alt=""
                className="w-full max-h-[min(70vh,28rem)] object-cover object-center"
              />
            </div>
          ) : null}

          <header className="space-y-2 mb-6">
            <h1 className="text-lg font-semibold text-foreground">
              {row.title?.trim() ? row.title : '（无标题）'}
            </h1>
            <time className="text-xs text-muted-foreground tabular-nums block">
              {format(new Date(createdAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
            </time>
          </header>

          {row.statusSnapshot ? (
            <div className="mb-6 rounded-md border border-dashed border-border/80 bg-muted/20 px-3 py-2 text-sm text-muted-foreground whitespace-pre-wrap">
              {row.statusSnapshot}
            </div>
          ) : null}

          <MarkdownContent
            markdown={row.content}
            className="text-sm text-muted-foreground"
            imageClassName="max-h-[min(70vh,24rem)] w-auto rounded-md border border-border/60 my-4"
          />
        </ContentReadingPanel>
      </article>
    </main>
  )
}
