import { NextRequest, NextResponse } from 'next/server'

import { isSiteLockSatisfied } from '@/lib/auth'
import {
  BuildInspirationRss,
  LoadInspirationFeedItems,
} from '@/lib/inspiration-feed'
import { BuildInspirationFeedMeta } from '@/lib/inspiration-feed-meta'
import { getPublicOrigin } from '@/lib/public-request-url'
import { getSiteConfigMemoryFirst } from '@/lib/site-config-cache'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  if (!(await isSiteLockSatisfied())) {
    return NextResponse.json({ success: false, error: 'Page is locked' }, { status: 403 })
  }

  try {
    const origin = getPublicOrigin(request)
    const [config, items] = await Promise.all([
      getSiteConfigMemoryFirst(),
      LoadInspirationFeedItems(origin),
    ])
    const meta = BuildInspirationFeedMeta(origin, config)
    const xml = BuildInspirationRss(meta, items)
    return new NextResponse(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      },
    })
  } catch (error) {
    console.error('[inspiration feed] rss build failed:', error)
    return NextResponse.json({ success: false, error: 'Failed to build feed' }, { status: 500 })
  }
}
