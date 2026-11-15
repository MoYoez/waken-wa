import { NextRequest, NextResponse } from 'next/server'

import { getSession, isSiteLockSatisfied } from '@/lib/auth'
import { getSiteConfigMemoryFirst } from '@/lib/site-config-cache'
import {
  GetStatusBadgeData,
  RenderStatusBadgeSvg,
  ToShieldsEndpoint,
} from '@/lib/status-badge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

const BADGE_LABEL_MAX_CHARS = 24

/**
 * Public status badge for READMEs and signatures.
 * - `format=json` (default) returns a Shields.io endpoint payload.
 * - `format=svg` returns a self-contained flat SVG badge.
 * Reuses the same gating as the status card: enabled flag plus site lock,
 * with an admin session able to preview while disabled.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const format = (searchParams.get('format') ?? 'json').toLowerCase()
  const label = (searchParams.get('label') ?? 'status').slice(0, BADGE_LABEL_MAX_CHARS)

  const [config, adminSession] = await Promise.all([getSiteConfigMemoryFirst(), getSession()])

  const gatedOut =
    (config?.statusCardEnabled !== true && !adminSession) ||
    (!(await isSiteLockSatisfied()) && !adminSession)

  try {
    const data = gatedOut
      ? { label, message: 'unavailable', color: '#9CA3AF', isOnline: false }
      : await GetStatusBadgeData(label)

    if (format === 'svg') {
      return new NextResponse(RenderStatusBadgeSvg(data), {
        status: 200,
        headers: {
          'Content-Type': 'image/svg+xml; charset=utf-8',
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      })
    }

    return NextResponse.json(ToShieldsEndpoint(data), {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    console.error('[status badge] build failed:', error)
    const fallback = { label, message: 'error', color: '#EF4444', isOnline: false }
    if (format === 'svg') {
      return new NextResponse(RenderStatusBadgeSvg(fallback), {
        status: 200,
        headers: { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'no-store' },
      })
    }
    return NextResponse.json(ToShieldsEndpoint(fallback), {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    })
  }
}
