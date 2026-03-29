import { and, eq } from 'drizzle-orm'
import type { NextRequest } from 'next/server'

import { db } from '@/lib/db'
import { devices, siteConfig } from '@/lib/drizzle-schema'
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
  const [config] = await db
    .select({ inspirationAllowedDeviceHashes: siteConfig.inspirationAllowedDeviceHashes })
    .from(siteConfig)
    .where(eq(siteConfig.id, 1))
    .limit(1)
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
      error: '灵感随想录 API 已限制为无可用设备，请在后端「网站设置」中调整',
    }
  }

  const key = extractInspirationDeviceKey(request, body)
  if (!key) {
    return {
      ok: false,
      status: 400,
      error:
        '已启用「仅指定设备可提交随想录」：请在请求头加入 X-Device-Key（值为该设备的设备身份牌），或在 JSON 中传 generatedHashKey',
    }
  }

  if (!allowlist.includes(key)) {
    return { ok: false, status: 403, error: '该设备未在「灵感随想录」允许列表中' }
  }

  const [device] = await db
    .select({ id: devices.id })
    .from(devices)
    .where(
      and(
        eq(devices.generatedHashKey, key),
        eq(devices.apiTokenId, tokenId),
        eq(devices.status, 'active'),
      ),
    )
    .limit(1)
  if (!device) {
    return {
      ok: false,
      status: 403,
      error: '设备标识与当前 Bearer Token 不匹配，或设备未激活',
    }
  }

  return { ok: true }
}
