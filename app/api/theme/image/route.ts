import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type ThemeImageResolverMode = 'direct' | 'randomApi'
const MAX_RANDOM_API_REDIRECTS = 6

function isAllowedRemoteImageUrl(raw: string): boolean {
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

function readImageUrlFromText(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''

  const hrefMatch = trimmed.match(/href=["'](https?:\/\/[^"'<>]+)["']/i)
  if (hrefMatch?.[1]) {
    return hrefMatch[1].trim()
  }

  const directMatch = trimmed.match(/https?:\/\/[^\s"'<>]+/i)
  return directMatch?.[0]?.trim() ?? ''
}

function isRedirectStatus(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308
}

async function fetchImageUpstream(rawUrl: string): Promise<{ response: Response; sourceUrl: string }> {
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
    throw new Error(`Upstream image fetch failed (${upstream.status})`)
  }

  const contentType = upstream.headers.get('content-type')?.toLowerCase() ?? ''
  if (!contentType.startsWith('image/')) {
    throw new Error('Upstream did not return an image')
  }

  return {
    response: upstream,
    sourceUrl: upstream.url || rawUrl,
  }
}

async function fetchRandomResolvedImage(rawUrl: string): Promise<{ response: Response; sourceUrl: string }> {
  let currentUrl = rawUrl

  for (let index = 0; index < MAX_RANDOM_API_REDIRECTS; index += 1) {
    const upstream = await fetch(currentUrl, {
      method: 'GET',
      redirect: 'manual',
      cache: 'no-store',
      headers: {
        Accept: 'application/json,text/plain,image/*;q=0.9,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (compatible; WakenThemeRandomApiProxy/1.0)',
      },
    })

    if (isRedirectStatus(upstream.status)) {
      const location = upstream.headers.get('location')?.trim() ?? ''
      if (!location) {
        throw new Error(`Random api redirect missing location (${upstream.status})`)
      }

      const nextUrl = new URL(location, currentUrl).toString()
      if (!isAllowedRemoteImageUrl(nextUrl)) {
        throw new Error('Random api redirect target is invalid')
      }

      currentUrl = nextUrl
      continue
    }

    if (!upstream.ok) {
      throw new Error(`Upstream random api failed (${upstream.status})`)
    }

    const contentType = upstream.headers.get('content-type')?.toLowerCase() ?? ''
    if (contentType.startsWith('image/')) {
      return {
        response: upstream,
        sourceUrl: upstream.url || currentUrl,
      }
    }

    if (contentType.includes('application/json')) {
      const json = await upstream.json().catch(() => null)
      const imageUrl = readImageUrlFromJson(json)
      if (!imageUrl || !isAllowedRemoteImageUrl(imageUrl)) {
        throw new Error('Random api did not return a valid image url')
      }
      return fetchImageUpstream(imageUrl)
    }

    const text = await upstream.text()
    const imageUrl = readImageUrlFromText(text)
    if (imageUrl && isAllowedRemoteImageUrl(imageUrl)) {
      return fetchImageUpstream(imageUrl)
    }

    throw new Error('Random api did not return an image payload')
  }

  throw new Error('Random api redirected too many times')
}

async function fetchRandomResolvedImageUrl(rawUrl: string): Promise<string> {
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
    throw new Error(`Upstream random api failed (${upstream.status})`)
  }

  const contentType = upstream.headers.get('content-type')?.toLowerCase() ?? ''
  if (contentType.startsWith('image/')) {
    return upstream.url || rawUrl
  }

  if (contentType.includes('application/json')) {
    const json = await upstream.json().catch(() => null)
    const imageUrl = readImageUrlFromJson(json)
    if (!imageUrl || !isAllowedRemoteImageUrl(imageUrl)) {
      throw new Error('Random api did not return a valid image url')
    }
    return imageUrl
  }

  return upstream.url || rawUrl
}

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get('url')?.trim() ?? ''
  const resolverParam = request.nextUrl.searchParams.get('resolver')?.trim() ?? 'direct'
  const resolver: ThemeImageResolverMode =
    resolverParam === 'randomApi' ? 'randomApi' : 'direct'
  if (!rawUrl || !isAllowedRemoteImageUrl(rawUrl)) {
    return NextResponse.json({ success: false, error: 'Invalid image url' }, { status: 400 })
  }

  try {
    const resolved =
      resolver === 'randomApi'
        ? await fetchRandomResolvedImage(rawUrl)
        : await fetchImageUpstream(rawUrl)

    const contentType = resolved.response.headers.get('content-type')?.toLowerCase() ?? ''
    const buffer = await resolved.response.arrayBuffer()
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
        'X-Waken-Theme-Source-Url': resolved.sourceUrl,
        'Access-Control-Expose-Headers': 'X-Waken-Theme-Source-Url',
      },
    })
  } catch (error) {
    console.error('theme image proxy failed:', error)
    return NextResponse.json({ success: false, error: 'Image proxy failed' }, { status: 500 })
  }
}
