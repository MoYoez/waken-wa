import { NextRequest, NextResponse } from 'next/server'

import { getOpenApiDocument } from '@/lib/openapi'
import { getPublicOrigin } from '@/lib/public-request-url'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  const origin = getPublicOrigin(request)
  return NextResponse.json(getOpenApiDocument(origin), {
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}
