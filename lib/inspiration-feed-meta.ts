import 'server-only'

import { DEFAULT_PAGE_TITLE } from '@/lib/default-page-title'
import type { InspirationFeedMeta } from '@/lib/inspiration-feed'
import { getTrimmedText } from '@/lib/status-card-text'

/** Compose feed channel metadata from site config, with safe defaults. */
export function BuildInspirationFeedMeta(
  origin: string,
  config: Record<string, unknown> | null | undefined,
): InspirationFeedMeta {
  const pageTitle = getTrimmedText(config?.pageTitle, DEFAULT_PAGE_TITLE)
  const authorName = getTrimmedText(config?.userName, 'Waken')
  const bio = getTrimmedText(config?.userBio)
  const siteTitle = `${pageTitle} · Inspiration`
  const siteDescription = bio || `${authorName}'s inspiration journal`
  return {
    siteTitle,
    siteDescription,
    homeUrl: origin,
    archiveUrl: `${origin}/inspiration`,
    authorName,
  }
}
