import 'server-only'

import { desc } from 'drizzle-orm'

import { db } from '@/lib/db'
import { inspirationEntries } from '@/lib/drizzle-schema'
import { inspirationEntryImageUrl } from '@/lib/inspiration-inline-images'
import { inspirationPlainPreviewAny } from '@/lib/inspiration-preview'
import { coerceDbTimestampToIsoUtc } from '@/lib/timezone'

export const INSPIRATION_FEED_MAX_ITEMS = 30
const INSPIRATION_FEED_SUMMARY_MAX_CHARS = 500

export type InspirationFeedItem = {
  id: number
  title: string | null
  summary: string
  url: string
  imageUrl: string | null
  createdAtIso: string
  updatedAtIso: string
}

export type InspirationFeedMeta = {
  siteTitle: string
  siteDescription: string
  homeUrl: string
  archiveUrl: string
  authorName: string
}

type InspirationFeedRow = {
  id: number
  title: string | null
  content: string
  contentLexical: string | null
  imageDataUrl: string | null
  createdAt: Date | string | number | null
  updatedAt: Date | string | number | null
}

/** Load the most recent inspiration entries as neutral feed items (RSS/JSON reuse this). */
export async function LoadInspirationFeedItems(
  origin: string,
  limit = INSPIRATION_FEED_MAX_ITEMS,
): Promise<InspirationFeedItem[]> {
  const safeLimit = Math.max(1, Math.min(INSPIRATION_FEED_MAX_ITEMS, Math.round(limit)))
  const rows = (await db
    .select()
    .from(inspirationEntries)
    .orderBy(desc(inspirationEntries.createdAt))
    .limit(safeLimit)) as InspirationFeedRow[]

  return rows.map((row) => {
    const preview = inspirationPlainPreviewAny(
      row.content ?? '',
      row.contentLexical,
      INSPIRATION_FEED_SUMMARY_MAX_CHARS,
    )
    const hasImage = typeof row.imageDataUrl === 'string' && row.imageDataUrl.trim().length > 0
    return {
      id: row.id,
      title: row.title?.trim() ? row.title.trim() : null,
      summary: preview.text,
      url: `${origin}/inspiration/${row.id}`,
      imageUrl: hasImage ? `${origin}${inspirationEntryImageUrl(row.id)}` : null,
      createdAtIso: coerceDbTimestampToIsoUtc(row.createdAt),
      updatedAtIso: coerceDbTimestampToIsoUtc(row.updatedAt ?? row.createdAt),
    }
  })
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function toRfc822(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? new Date(0).toUTCString() : d.toUTCString()
}

function feedItemTitle(item: InspirationFeedItem): string {
  if (item.title) return item.title
  const summary = item.summary.trim()
  if (!summary) return `#${item.id}`
  return summary.length > 60 ? `${summary.slice(0, 60).trim()}…` : summary
}

/** RSS 2.0 document. */
export function BuildInspirationRss(
  meta: InspirationFeedMeta,
  items: InspirationFeedItem[],
): string {
  const lastBuildDate = toRfc822(items[0]?.createdAtIso ?? new Date().toISOString())
  const entryXml = items
    .map((item) => {
      const parts = [
        `      <title>${escapeXml(feedItemTitle(item))}</title>`,
        `      <link>${escapeXml(item.url)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(item.url)}</guid>`,
        `      <pubDate>${toRfc822(item.createdAtIso)}</pubDate>`,
        `      <description>${escapeXml(item.summary)}</description>`,
      ]
      if (item.imageUrl) {
        parts.push(
          `      <enclosure url="${escapeXml(item.imageUrl)}" type="image/*" />`,
        )
      }
      return `    <item>\n${parts.join('\n')}\n    </item>`
    })
    .join('\n')

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    `    <title>${escapeXml(meta.siteTitle)}</title>`,
    `    <link>${escapeXml(meta.archiveUrl)}</link>`,
    `    <description>${escapeXml(meta.siteDescription)}</description>`,
    `    <language>zh-CN</language>`,
    `    <lastBuildDate>${lastBuildDate}</lastBuildDate>`,
    `    <atom:link href="${escapeXml(`${meta.homeUrl}/inspiration/feed.xml`)}" rel="self" type="application/rss+xml" />`,
    entryXml,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n')
}

/** JSON Feed 1.1 document (https://www.jsonfeed.org/version/1.1/). */
export function BuildInspirationJsonFeed(
  meta: InspirationFeedMeta,
  items: InspirationFeedItem[],
): Record<string, unknown> {
  return {
    version: 'https://jsonfeed.org/version/1.1',
    title: meta.siteTitle,
    home_page_url: meta.archiveUrl,
    feed_url: `${meta.homeUrl}/inspiration/feed.json`,
    description: meta.siteDescription,
    authors: [{ name: meta.authorName }],
    language: 'zh-CN',
    items: items.map((item) => ({
      id: item.url,
      url: item.url,
      title: feedItemTitle(item),
      content_text: item.summary,
      image: item.imageUrl ?? undefined,
      date_published: item.createdAtIso,
      date_modified: item.updatedAtIso,
    })),
  }
}
