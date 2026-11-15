import { NextResponse } from 'next/server'

import { GetHealthReport } from '@/lib/health-probe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const report = await GetHealthReport()
    return NextResponse.json(report, {
      status: report.status === 'ok' ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch {
    // Never let the liveness endpoint throw; report degraded instead.
    return NextResponse.json(
      {
        status: 'degraded',
        checks: {
          database: { status: 'down', driver: 'sqlite' },
          redis: { status: 'disabled' },
        },
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
