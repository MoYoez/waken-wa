import { NextRequest } from 'next/server'

import { getPublicOrigin } from '@/lib/public-request-url'
import { getSiteConfigMemoryFirst } from '@/lib/site-config-cache'
import { createDefaultSiteIconResponse } from '@/lib/site-default-icon'
import { isDataSiteIconUrl, isRemoteSiteIconUrl, normalizeSiteIconUrl } from '@/lib/site-icon'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

const SITE_ICON_CACHE_CONTROL = 'public, max-age=3600, s-maxage=3600'
const SITE_ICON_ACCEPT_HEADER = 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'

function withCacheHeaders<T extends Response>(response: T): T {
  response.headers.set('Cache-Control', SITE_ICON_CACHE_CONTROL)
  return response
}

function createFallbackSiteIconResponse() {
  return withCacheHeaders(createDefaultSiteIconResponse())
}

function createBinarySiteIconResponse(buffer: ArrayBuffer | Uint8Array, contentType: string) {
  const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer
  const stableBytes = Uint8Array.from(bytes)
  return withCacheHeaders(
    new Response(new Blob([stableBytes], { type: contentType }), {
      headers: {
        'Content-Type': contentType,
      },
    }),
  )
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

function isRecursiveSiteIconUrl(request: NextRequest, rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl)
    return url.origin === getPublicOrigin(request) && url.pathname === request.nextUrl.pathname
  } catch {
    return false
  }
}

function decodeDataSiteIconUrl(rawUrl: string): { buffer: Uint8Array; contentType: string } | null {
  const match = /^data:([^,]+),([\s\S]*)$/i.exec(rawUrl)
  if (!match) return null

  const meta = match[1]
  const payload = match[2]
  const parts = meta
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)
  const mediaType = parts[0]?.toLowerCase() ?? ''
  if (!mediaType.startsWith('image/')) return null

  const contentType = [mediaType, ...parts.slice(1).filter((item) => item.toLowerCase() !== 'base64')].join(';')
  const isBase64 = parts.slice(1).some((item) => item.toLowerCase() === 'base64')

  try {
    const buffer = isBase64
      ? new Uint8Array(Buffer.from(payload.replace(/\s+/g, ''), 'base64'))
      : new TextEncoder().encode(decodeURIComponent(payload))
    return { buffer, contentType: contentType || mediaType }
  } catch {
    return null
  }
}

async function fetchRemoteSiteIconBytes(
  rawUrl: string,
): Promise<{ buffer: ArrayBuffer; contentType: string } | null> {
  try {
    const upstream = await fetch(rawUrl, {
      method: 'GET',
      redirect: 'follow',
      cache: 'no-store',
      headers: {
        Accept: SITE_ICON_ACCEPT_HEADER,
        'User-Agent': 'Mozilla/5.0 (compatible; WakenSiteIconProxy/1.0)',
      },
    })

    if (!upstream.ok) {
      console.warn('site icon upstream fetch failed:', upstream.status, rawUrl)
      return null
    }

    const contentType = upstream.headers.get('content-type')?.trim() ?? ''
    if (!contentType.toLowerCase().startsWith('image/')) {
      console.warn('site icon upstream did not return an image:', contentType || '<empty>', rawUrl)
      return null
    }

    const buffer = await upstream.arrayBuffer()
    return { buffer, contentType }
  } catch (error) {
    if (isUpstreamTimeoutError(error)) {
      console.warn('site icon upstream timeout:', error)
      return null
    }
    console.error('site icon proxy failed:', error)
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const config = await getSiteConfigMemoryFirst()
    const configuredUrl = normalizeSiteIconUrl(config?.siteIconUrl)
    if (!configuredUrl) {
      return createFallbackSiteIconResponse()
    }

    if (isDataSiteIconUrl(configuredUrl)) {
      const decoded = decodeDataSiteIconUrl(configuredUrl)
      return decoded
        ? createBinarySiteIconResponse(decoded.buffer, decoded.contentType)
        : createFallbackSiteIconResponse()
    }

    if (!isRemoteSiteIconUrl(configuredUrl) || isRecursiveSiteIconUrl(request, configuredUrl)) {
      return createFallbackSiteIconResponse()
    }

    const upstream = await fetchRemoteSiteIconBytes(configuredUrl)
    return upstream
      ? createBinarySiteIconResponse(upstream.buffer, upstream.contentType)
      : createFallbackSiteIconResponse()
  } catch (error) {
    console.error('site icon route failed:', error)
    return createFallbackSiteIconResponse()
  }
}
