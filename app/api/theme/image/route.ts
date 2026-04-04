import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function isAllowedRemoteImageUrl(raw: string): boolean {
  try {
    const url = new URL(raw)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get('url')?.trim() ?? ''
  if (!rawUrl || !isAllowedRemoteImageUrl(rawUrl)) {
    return NextResponse.json({ success: false, error: 'Invalid image url' }, { status: 400 })
  }

  try {
    const upstream = await fetch(rawUrl, {
      method: 'GET',
      redirect: 'follow',
      cache: 'no-store',
      headers: {
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (compatible; WakenThemeImageProxy/1.0)',
      },
    })

    if (!upstream.ok) {
      return NextResponse.json(
        { success: false, error: `Upstream image fetch failed (${upstream.status})` },
        { status: 502 },
      )
    }

    const contentType = upstream.headers.get('content-type')?.toLowerCase() ?? ''
    if (!contentType.startsWith('image/')) {
      return NextResponse.json(
        { success: false, error: 'Upstream did not return an image' },
        { status: 415 },
      )
    }

    const buffer = await upstream.arrayBuffer()
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    })
  } catch (error) {
    console.error('theme image proxy failed:', error)
    return NextResponse.json({ success: false, error: 'Image proxy failed' }, { status: 500 })
  }
}
