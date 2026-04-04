import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function isAllowedRemoteUrl(raw: string): boolean {
  try {
    const url = new URL(raw)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function readImageUrlFromJson(value: unknown): string {
  if (!value || typeof value !== 'object') return ''
  const row = value as Record<string, unknown>

  for (const key of ['url', 'image', 'imageUrl', 'src', 'download_url']) {
    const candidate = String(row[key] ?? '').trim()
    if (candidate) return candidate
  }

  const urls = row.urls
  if (urls && typeof urls === 'object') {
    const nested = urls as Record<string, unknown>
    for (const key of ['regular', 'full', 'raw', 'small']) {
      const candidate = String(nested[key] ?? '').trim()
      if (candidate) return candidate
    }
  }

  const data = row.data
  if (data && typeof data === 'object') {
    return readImageUrlFromJson(data)
  }

  return ''
}

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get('url')?.trim() ?? ''
  if (!rawUrl || !isAllowedRemoteUrl(rawUrl)) {
    return NextResponse.json({ success: false, error: 'Invalid random api url' }, { status: 400 })
  }

  try {
    const upstream = await fetch(rawUrl, {
      method: 'GET',
      redirect: 'follow',
      cache: 'no-store',
      headers: {
        Accept: 'application/json,image/*;q=0.9,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (compatible; WakenThemeRandomApiProxy/1.0)',
      },
    })

    if (!upstream.ok) {
      return NextResponse.json(
        { success: false, error: `Upstream random api failed (${upstream.status})` },
        { status: 502 },
      )
    }

    const contentType = upstream.headers.get('content-type')?.toLowerCase() ?? ''
    if (contentType.startsWith('image/')) {
      return NextResponse.json({
        success: true,
        data: {
          imageUrl: upstream.url || rawUrl,
        },
      })
    }

    if (contentType.includes('application/json')) {
      const json = await upstream.json().catch(() => null)
      const imageUrl = readImageUrlFromJson(json)
      if (!imageUrl || !isAllowedRemoteUrl(imageUrl)) {
        return NextResponse.json(
          { success: false, error: 'Random api did not return a valid image url' },
          { status: 502 },
        )
      }
      return NextResponse.json({
        success: true,
        data: {
          imageUrl,
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        imageUrl: upstream.url || rawUrl,
      },
    })
  } catch (error) {
    console.error('theme random api proxy failed:', error)
    return NextResponse.json({ success: false, error: 'Random api proxy failed' }, { status: 500 })
  }
}
