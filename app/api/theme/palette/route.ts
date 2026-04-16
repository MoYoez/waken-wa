import { NextRequest, NextResponse } from 'next/server'

import { getPublicOrigin } from '@/lib/public-request-url'
import { extractThemeSurfaceFromImageBuffer } from '@/lib/theme-image-palette-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

type ThemePaletteRequestBody = {
  displayUrl?: unknown
  seedUrl?: unknown
}

function resolveThemePaletteSourceUrl(request: NextRequest, rawInput: unknown): string {
  const clean = String(rawInput ?? '').trim()
  if (!clean) {
    throw new Error('Missing display url')
  }
  if (/^blob:/i.test(clean)) {
    throw new Error('Blob urls are not supported by the server palette extractor')
  }
  if (/^data:image\//i.test(clean)) {
    return clean
  }

  const origin = getPublicOrigin(request)

  try {
    const url = new URL(clean)
    if (url.origin !== origin) {
      throw new Error('Only same-origin image urls are allowed')
    }
    return url.toString()
  } catch (error) {
    if (!clean.startsWith('/')) {
      throw error
    }
  }

  return `${origin}${clean}`
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as ThemePaletteRequestBody | null
    const sourceUrl = resolveThemePaletteSourceUrl(request, body?.displayUrl)
    const seedUrl = String(body?.seedUrl ?? '').trim() || sourceUrl

    const upstream = await fetch(sourceUrl, {
      method: 'GET',
      redirect: 'follow',
      cache: 'no-store',
      headers: {
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (compatible; WakenThemePaletteProxy/1.0)',
      },
    })

    if (!upstream.ok) {
      return NextResponse.json(
        { success: false, error: `Palette image fetch failed (${upstream.status})` },
        { status: 502 },
      )
    }

    const contentType = upstream.headers.get('content-type')?.toLowerCase() ?? ''
    if (!contentType.startsWith('image/')) {
      return NextResponse.json(
        { success: false, error: 'Palette source did not return an image' },
        { status: 400 },
      )
    }

    const buffer = Buffer.from(await upstream.arrayBuffer())
    const theme = await extractThemeSurfaceFromImageBuffer(buffer, seedUrl)

    return NextResponse.json({
      success: true,
      data: {
        theme,
      },
    })
  } catch (error) {
    console.error('theme palette extraction failed:', error)
    return NextResponse.json(
      { success: false, error: 'Theme palette extraction failed' },
      { status: 500 },
    )
  }
}
