import { NextRequest, NextResponse } from 'next/server'

import { getOpenApiDocument } from '@/lib/openapi'
import { isOpenApiDocsEnabled } from '@/lib/openapi-access'
import { getPublicOrigin } from '@/lib/public-request-url'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  if (!(await isOpenApiDocsEnabled())) {
    return NextResponse.json({ success: false, error: 'OpenAPI 文档未启用' }, { status: 404 })
  }

  const origin = getPublicOrigin(request)
  return NextResponse.json(getOpenApiDocument(origin), {
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}
