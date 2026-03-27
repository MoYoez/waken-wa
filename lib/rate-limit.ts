const store = new Map<string, { count: number; resetAt: number }>()
let opCount = 0

/**
 * In-memory sliding-window rate limiter.
 * Effective per-process; in serverless deployments each isolate keeps its own
 * counter, which still throttles single-origin bursts.
 */
export function isRateLimited(
  key: string,
  maxRequests: number,
  windowMs: number,
): boolean {
  const now = Date.now()

  if (++opCount % 100 === 0) {
    for (const [k, entry] of store) {
      if (now > entry.resetAt) store.delete(k)
    }
  }

  const entry = store.get(key)
  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return false
  }
  entry.count++
  return entry.count > maxRequests
}
