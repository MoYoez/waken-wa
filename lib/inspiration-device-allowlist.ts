import type { NextRequest } from 'next/server'

import { isActiveDeviceBoundToTokenCached } from '@/lib/device-auth-cache'
import { getSiteConfigMemoryFirst } from '@/lib/site-config-cache'
import type { InspirationTokenGateResult } from '@/types/inspiration'

export type { InspirationTokenGateResult } from '@/types/inspiration'

/** null = any device; [] = none; else whitelist of Device.generatedHashKey. */
export function normalizeInspirationAllowedHashes(value: unknown): string[] | null {
  if (value === null || value === undefined) return null
  if (!Array.isArray(value)) return null
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of value) {
    const s = String(item ?? '').trim()
    if (!s || seen.has(s)) continue
    seen.add(s)
    out.push(s)
  }
  return out
}

export function extractInspirationDeviceKey(
  request: NextRequest,
  body?: Record<string, unknown> | null,
): string | null {
  const h =
    request.headers.get('x-device-key')?.trim() ||
    request.headers.get('x-generated-hash-key')?.trim()
  if (h) return h
  if (!body || typeof body !== 'object') return null
  const fromBody =
    (typeof body.generatedHashKey === 'string' && body.generatedHashKey.trim()) ||
    (typeof body.generated_hash_key === 'string' && body.generated_hash_key.trim()) ||
    (typeof body.device_key === 'string' && body.device_key.trim()) ||
    (typeof body.deviceKey === 'string' && body.deviceKey.trim())
  return fromBody || null
}

/** Bearer-token inspiration APIs: enforce SiteConfig device allowlist. */
export async function gateInspirationApiForDevice(
  tokenId: number,
  request: NextRequest,
  body?: Record<string, unknown> | null,
): Promise<InspirationTokenGateResult> {
  const config = await getSiteConfigMemoryFirst()
  const allowlist = normalizeInspirationAllowedHashes(
    config?.inspirationAllowedDeviceHashes ?? null,
  )
  if (allowlist === null) {
    return { ok: true }
  }
  if (allowlist.length === 0) {
    return {
      ok: false,
      status: 403,
      error: 'The inspiration API is restricted to no available devices. Update the allowlist in Site Settings.',
    }
  }

  const key = extractInspirationDeviceKey(request, body)
  if (!key) {
    return {
      ok: false,
      status: 400,
      error:
        'Only approved devices can submit inspiration entries. Provide X-Device-Key or generatedHashKey.',
    }
  }

  if (!allowlist.includes(key)) {
    return { ok: false, status: 403, error: 'This device is not in the inspiration allowlist' }
  }

  const ok = await isActiveDeviceBoundToTokenCached(tokenId, key)
  if (!ok) {
    return {
      ok: false,
      status: 403,
      error: 'The device key does not match the current Bearer token, or the device is inactive',
    }
  }

  return { ok: true }
}
