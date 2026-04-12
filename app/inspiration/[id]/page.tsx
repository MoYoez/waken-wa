import { eq } from 'drizzle-orm'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { MarkdownContent } from '@/components/admin/markdown-content'
import { ContentReadingPanel } from '@/components/content-reading-panel'
import { FormattedTime } from '@/components/formatted-time'
import { LexicalContent } from '@/components/lexical-content'
import { SiteReveal } from '@/components/site-reveal'
import { db } from '@/lib/db'
import { inspirationEntries, siteConfig } from '@/lib/drizzle-schema'
import { inspirationLooksLikeMarkdown } from '@/lib/inspiration-preview'
import { coerceDbTimestampToIsoUtc, normalizeTimezone } from '@/lib/timezone'


export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: raw } = await params
  const id = parseInt(raw, 10)
  if (!Number.isFinite(id)) return { title: '随想录' }

  const [row] = await db
    .select({ title: inspirationEntries.title })
    .from(inspirationEntries)
    .where(eq(inspirationEntries.id, id))
    .limit(1)
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

  const [row, config] = await Promise.all([
    db.select().from(inspirationEntries).where(eq(inspirationEntries.id, id)).limit(1),
    db.select({ displayTimezone: siteConfig.displayTimezone }).from(siteConfig).limit(1),
  ])
  const entry = row[0]
  if (!entry) notFound()

  const createdAt = coerceDbTimestampToIsoUtc(entry.createdAt)
  const displayTimezone = normalizeTimezone(config[0]?.displayTimezone)

  return (
    <main className="relative min-h-screen overflow-x-hidden">
      <article className="mx-auto max-w-2xl overflow-x-hidden px-4 pt-16 pb-24 sm:px-6">
        <ContentReadingPanel className="p-5 sm:p-6">
          <SiteReveal delay={0.04}>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground mb-8">
              <Link href="/" className="hover:text-foreground transition-colors">
                ← 首页
              </Link>
              <Link href="/inspiration" className="hover:text-foreground transition-colors">
                全部随想录
              </Link>
            </div>
          </SiteReveal>

          {entry.imageDataUrl ? (
            <SiteReveal delay={0.08}>
              <div className="mb-6 rounded-md overflow-hidden border border-border bg-muted/30">
                <Image
                  src={entry.imageDataUrl}
                  alt=""
                  width={1200}
                  height={900}
                  loading="eager"
                  className="w-full max-h-[min(70vh,28rem)] object-cover object-center"
                />
              </div>
            </SiteReveal>
          ) : null}

          <SiteReveal delay={0.12}>
            <header className="space-y-2 mb-6">
              <h1 className="text-lg font-semibold text-foreground">
                {entry.title?.trim() ? entry.title : '（无标题）'}
              </h1>
              <FormattedTime
                date={createdAt}
                timezone={displayTimezone}
                className="text-xs text-muted-foreground tabular-nums block"
              />
            </header>
          </SiteReveal>

          {entry.statusSnapshot ? (
            <SiteReveal delay={0.16}>
              <div className="mb-6 rounded-md border border-dashed border-border/80 bg-muted/20 px-3 py-2 text-sm text-muted-foreground whitespace-pre-wrap">
                {entry.statusSnapshot}
              </div>
            </SiteReveal>
          ) : null}

          <SiteReveal delay={0.2}>
            {entry.contentLexical ? (
              inspirationLooksLikeMarkdown(entry.content) ? (
                <MarkdownContent
                  markdown={entry.content}
                  className="text-sm text-muted-foreground"
                  imageClassName="max-h-[min(70vh,24rem)] w-auto rounded-md border border-border/60 my-4"
                />
              ) : (
                <LexicalContent content={entry.contentLexical} className="text-sm text-muted-foreground" />
              )
            ) : (
              <MarkdownContent
                markdown={entry.content}
                className="text-sm text-muted-foreground"
                imageClassName="max-h-[min(70vh,24rem)] w-auto rounded-md border border-border/60 my-4"
              />
            )}
          </SiteReveal>
        </ContentReadingPanel>
      </article>
    </main>
  )
}
