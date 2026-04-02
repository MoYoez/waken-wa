import 'server-only'

import { NextRequest, NextResponse } from 'next/server'

import { isRedisCacheForcedOnServerless } from '@/lib/cache-runtime-toggle'
import { checkRateLimit } from '@/lib/rate-limit'

const degradedBucketsWarned = new Set<string>()

function getClientIp(request: NextRequest): string {
  const xForwardedFor = request.headers.get('x-forwarded-for') || ''
  if (xForwardedFor.trim()) {
    return xForwardedFor.split(',')[0]!.trim()
  }
  const realIp = request.headers.get('x-real-ip') || ''
  if (realIp.trim()) return realIp.trim()
  return 'unknown'
}

function toRateLimitResponse(options: {
  maxRequests: number
  resetAt: number
  backend: 'redis' | 'memory'
}): NextResponse {
  const now = Date.now()
  const retryAfterSeconds = Math.max(1, Math.ceil((options.resetAt - now) / 1000))
  return NextResponse.json(
    {
      success: false,
      error: '请求过于频繁，请稍后再试',
      retryAfterSeconds,
      rateLimitBackend: options.backend,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfterSeconds),
        'X-RateLimit-Limit': String(options.maxRequests),
        'X-RateLimit-Reset': String(options.resetAt),
        'X-RateLimit-Backend': options.backend,
      },
    },
  )
}

export async function enforceApiRateLimit(
  request: NextRequest,
  options: {
    bucket: string
    maxRequests: number
    windowMs: number
    tokenKey?: string | number | null
  },
): Promise<NextResponse | null> {
  const ip = getClientIp(request)
  const tokenPart = options.tokenKey == null ? 'none' : String(options.tokenKey)
  const key = `api:${options.bucket}:ip:${ip}:token:${tokenPart}`
  const result = await checkRateLimit(key, options.maxRequests, options.windowMs)

  // In serverless+redis-forced mode, memory fallback means redis is degraded.
  if (result.backend === 'memory' && isRedisCacheForcedOnServerless()) {
    const warnKey = `${options.bucket}:${ip}`
    if (!degradedBucketsWarned.has(warnKey)) {
      degradedBucketsWarned.add(warnKey)
      console.warn(
        `[rate-limit] redis forced on serverless but memory fallback used: bucket=${options.bucket}, ip=${ip}`,
      )
    }
  }

  if (!result.limited) return null
  return toRateLimitResponse({
    maxRequests: options.maxRequests,
    resetAt: result.resetAt,
    backend: result.backend,
  })
}

