import { NextRequest, NextResponse } from 'next/server'

import { resolveConfiguredThemeRandomImageUrl } from '@/lib/theme-random-api'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.size > 0) {
    return NextResponse.json(
      { success: false, error: 'Random api does not accept query parameters' },
      { status: 400 },
    )
  }

  try {
    const imageUrl = await resolveConfiguredThemeRandomImageUrl()
    return NextResponse.json({
      success: true,
      data: {
        imageUrl,
      },
    })
  } catch (error) {
    console.error('theme random api proxy failed:', error)
    return NextResponse.json({ success: false, error: 'Random api proxy failed' }, { status: 500 })
  }
}
