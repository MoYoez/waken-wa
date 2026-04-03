import 'server-only'

import { randomBytes } from 'node:crypto'

import { shouldUseRedisCache } from '@/lib/cache-runtime-toggle'
import {
  redisDel,
  redisZAdd,
  redisZCard,
  redisZRemRangeByScore,
} from '@/lib/redis-client'
import { VIEWER_PRESENCE_TTL_MS } from '@/lib/viewer-presence-constants'

const VIEWER_PRESENCE_ZSET_KEY = 'waken:viewers:presence:v1'
const VIEWER_PRESENCE_ID_RE = /^[A-Za-z0-9_-]{16,128}$/

declare global {
  var __wakenViewerPresenceMemory: Map<string, number> | undefined
}

function getViewerPresenceMemory(): Map<string, number> {
  if (!globalThis.__wakenViewerPresenceMemory) {
    globalThis.__wakenViewerPresenceMemory = new Map<string, number>()
  }
  return globalThis.__wakenViewerPresenceMemory
}

function cleanupExpiredMemory(nowMs: number): number {
  const state = getViewerPresenceMemory()
  for (const [viewerId, expiresAtMs] of state.entries()) {
    if (expiresAtMs <= nowMs) {
      state.delete(viewerId)
    }
  }
  return state.size
}

async function cleanupExpiredRedis(nowMs: number): Promise<number> {
  await redisZRemRangeByScore(VIEWER_PRESENCE_ZSET_KEY, 0, nowMs)
  const count = await redisZCard(VIEWER_PRESENCE_ZSET_KEY)
  if (!count) {
    await redisDel(VIEWER_PRESENCE_ZSET_KEY)
    return 0
  }
  return count
}

export function normalizeViewerPresenceId(value: string | null | undefined): string | null {
  const trimmed = String(value ?? '').trim()
  return VIEWER_PRESENCE_ID_RE.test(trimmed) ? trimmed : null
}

export function createViewerPresenceId(): string {
  return randomBytes(18).toString('base64url')
}

export async function touchViewerPresence(viewerId: string, nowMs = Date.now()): Promise<number> {
  const normalizedViewerId = normalizeViewerPresenceId(viewerId)
  if (!normalizedViewerId) {
    throw new Error('Invalid viewer presence id')
  }

  const expiresAtMs = nowMs + VIEWER_PRESENCE_TTL_MS

  if (await shouldUseRedisCache()) {
    await redisZAdd(VIEWER_PRESENCE_ZSET_KEY, expiresAtMs, normalizedViewerId)
    return cleanupExpiredRedis(nowMs)
  }

  const state = getViewerPresenceMemory()
  cleanupExpiredMemory(nowMs)
  state.set(normalizedViewerId, expiresAtMs)
  return cleanupExpiredMemory(nowMs)
}

export async function getViewerPresenceCount(nowMs = Date.now()): Promise<number> {
  if (await shouldUseRedisCache()) {
    return cleanupExpiredRedis(nowMs)
  }
  return cleanupExpiredMemory(nowMs)
}

