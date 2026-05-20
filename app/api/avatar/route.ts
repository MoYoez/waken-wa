import { NextRequest, NextResponse } from 'next/server'

import { requireAdminSession, unauthorizedJson } from '@/lib/admin-api-auth'
import { isRemoteAvatarUrl } from '@/lib/avatar-url'
import { extractImageSourcePublicKey, readImageSourceDataUrl } from '@/lib/image-source-store'
import { CreateTransformedImageResponse } from '@/lib/image-transform-response'
import { decodeInlineImageDataUrl, inlineImageBody } from '@/lib/inline-image-data'
import { getSiteConfigMemoryFirst } from '@/lib/site-config-cache'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const AVATAR_IMAGE_RESPONSE_OPTIONS = {
  cacheControl: 'public, max-age=3600, s-maxage=3600',
  defaultFormat: 'webp' as const,
  defaultQuality: 72,
  defaultWidth: 128,
}

function isUpstreamTimeoutError(error: unknown): boolean {
  const current = error as {
    code?: unknown
    cause?: { code?: unknown }
  }
  return (
    current?.code === 'UND_ERR_CONNECT_TIMEOUT' ||
    current?.cause?.code === 'UND_ERR_CONNECT_TIMEOUT' ||
    current?.code === 'ABORT_ERR' ||
    current?.cause?.code === 'ABORT_ERR'
  )
}

async function fetchAvatarResponse(request: NextRequest, rawUrl: string) {
  try {
    const upstream = await fetch(rawUrl, {
      method: 'GET',
      redirect: 'follow',
      next: { revalidate: 3600 },
      headers: {
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (compatible; WakenAvatarProxy/1.0)',
      },
    })

    if (!upstream.ok) {
      return NextResponse.json(
        { success: false, error: `Upstream avatar fetch failed (${upstream.status})` },
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
    return CreateTransformedImageResponse(buffer, contentType, request, AVATAR_IMAGE_RESPONSE_OPTIONS)
  } catch (error) {
    if (isUpstreamTimeoutError(error)) {
      console.warn('avatar proxy upstream timeout:', error)
      return NextResponse.json(
        { success: false, error: 'Avatar upstream timeout' },
        { status: 504 },
      )
    }
    console.error('avatar proxy failed:', error)
    return NextResponse.json({ success: false, error: 'Avatar proxy failed' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const previewUrl = request.nextUrl.searchParams.get('url')?.trim() ?? ''
  if (previewUrl) {
    const session = await requireAdminSession()
    if (!session) {
      return unauthorizedJson()
    }
    if (!isRemoteAvatarUrl(previewUrl)) {
      return NextResponse.json({ success: false, error: 'Invalid avatar url' }, { status: 400 })
    }
    return fetchAvatarResponse(request, previewUrl)
  }

  const config = await getSiteConfigMemoryFirst()
  const configuredUrl = String(config?.avatarUrl ?? '').trim()
  if (/^data:image\//i.test(configuredUrl)) {
    const decoded = decodeInlineImageDataUrl(configuredUrl)
    if (!decoded) {
      return NextResponse.json({ success: false, error: 'Invalid avatar image data' }, { status: 404 })
    }
    return CreateTransformedImageResponse(
      inlineImageBody(decoded.buffer),
      decoded.contentType,
      request,
      AVATAR_IMAGE_RESPONSE_OPTIONS,
    )
  }
  const imageSourceKey = extractImageSourcePublicKey(configuredUrl)
  if (imageSourceKey) {
    const dataUrl = await readImageSourceDataUrl(imageSourceKey)
    const decoded = dataUrl ? decodeInlineImageDataUrl(dataUrl) : null
    if (!decoded) {
      return NextResponse.json({ success: false, error: 'Invalid avatar image source' }, { status: 404 })
    }
    return CreateTransformedImageResponse(
      inlineImageBody(decoded.buffer),
      decoded.contentType,
      request,
      AVATAR_IMAGE_RESPONSE_OPTIONS,
    )
  }
  if (!config?.avatarFetchByServerEnabled || !isRemoteAvatarUrl(configuredUrl)) {
    return NextResponse.json({ success: false, error: 'Avatar proxy is disabled' }, { status: 404 })
  }

  return fetchAvatarResponse(request, configuredUrl)
}
