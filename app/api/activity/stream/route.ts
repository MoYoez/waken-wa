import { NextRequest, NextResponse } from 'next/server'

import { ACTIVITY_FEED_DEFAULT_LIMIT } from '@/lib/activity-api-constants'
import { enforceApiRateLimit } from '@/lib/api-rate-limit'
import { getActivityFeedData } from '@/lib/activity-feed'
import { getCachedActivityFeedData } from '@/lib/activity-feed-cache'
import {
  ACTIVITY_STREAM_MAX_CONCURRENT_CONNECTIONS,
  ACTIVITY_STREAM_MAX_CONSECUTIVE_PUSH_FAILURES,
  ACTIVITY_STREAM_MAX_IDLE_MS,
  ACTIVITY_STREAM_POLL_INTERVAL_MS,
} from '@/lib/activity-stream-constants'
import { isSiteLockSatisfied } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

const ACTIVITY_STREAM_OPEN_RATE_LIMIT_MAX = 30
const ACTIVITY_STREAM_OPEN_RATE_LIMIT_WINDOW_MS = 60_000

let activeStreams = 0
let nextClientId = 1

type StreamClient = {
  id: number
  controller: ReadableStreamDefaultController<Uint8Array>
  idleCloseTimer: ReturnType<typeof setTimeout> | null
  closed: boolean
}

const clients = new Map<number, StreamClient>()
const encoder = new TextEncoder()

let broadcasterTimer: ReturnType<typeof setInterval> | null = null
let broadcasterPushInFlight = false
let consecutivePushFailures = 0

function toSseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

function maybeStopBroadcaster() {
  if (clients.size > 0) return
  if (broadcasterTimer) {
    clearInterval(broadcasterTimer)
    broadcasterTimer = null
  }
  consecutivePushFailures = 0
  broadcasterPushInFlight = false
}

function closeClient(client: StreamClient) {
  if (client.closed) return
  client.closed = true
  if (client.idleCloseTimer) {
    clearTimeout(client.idleCloseTimer)
    client.idleCloseTimer = null
  }
  clients.delete(client.id)
  activeStreams = Math.max(0, activeStreams - 1)
  maybeStopBroadcaster()
}

function bumpClientIdleLease(client: StreamClient) {
  if (client.closed) return
  if (client.idleCloseTimer) {
    clearTimeout(client.idleCloseTimer)
  }
  client.idleCloseTimer = setTimeout(() => {
    closeClient(client)
    try {
      client.controller.close()
    } catch {
      /* already closed */
    }
  }, ACTIVITY_STREAM_MAX_IDLE_MS)
}

function safeEnqueue(client: StreamClient, chunk: Uint8Array): boolean {
  if (client.closed) return false
  try {
    client.controller.enqueue(chunk)
    bumpClientIdleLease(client)
    return true
  } catch {
    closeClient(client)
    return false
  }
}

function broadcast(event: string, data: unknown) {
  const chunk = encoder.encode(toSseEvent(event, data))
  for (const client of clients.values()) {
    safeEnqueue(client, chunk)
  }
}

async function pushCachedSnapshotToClient(client: StreamClient): Promise<boolean> {
  const cached = await getCachedActivityFeedData()
  if (!cached) return false
  return safeEnqueue(client, encoder.encode(toSseEvent('activity', { success: true, data: cached })))
}

async function pushSharedActivity() {
  if (broadcasterPushInFlight || clients.size === 0) return
  broadcasterPushInFlight = true
  try {
    const payload = await getActivityFeedData(ACTIVITY_FEED_DEFAULT_LIMIT, {
      forPublicFeed: true,
    })
    consecutivePushFailures = 0
    broadcast('activity', { success: true, data: payload })
  } catch (error) {
    console.error('[activity stream] push failed:', error)
    consecutivePushFailures++
    broadcast('error', {
      success: false,
      error: 'stream update failed',
      failures: consecutivePushFailures,
    })
    if (consecutivePushFailures >= ACTIVITY_STREAM_MAX_CONSECUTIVE_PUSH_FAILURES) {
      // Keep trying on next ticks; avoid hard-closing all clients on transient upstream failures.
      consecutivePushFailures = ACTIVITY_STREAM_MAX_CONSECUTIVE_PUSH_FAILURES
    }
  } finally {
    broadcasterPushInFlight = false
  }
}

function ensureBroadcasterRunning(options?: { skipImmediatePush?: boolean }) {
  if (broadcasterTimer) return
  if (!options?.skipImmediatePush) {
    void pushSharedActivity()
  }
  broadcasterTimer = setInterval(() => {
    void pushSharedActivity()
  }, ACTIVITY_STREAM_POLL_INTERVAL_MS)
}

export async function GET(request: NextRequest) {
  const limitedResponse = await enforceApiRateLimit(request, {
    bucket: 'activity-stream-open',
    maxRequests: ACTIVITY_STREAM_OPEN_RATE_LIMIT_MAX,
    windowMs: ACTIVITY_STREAM_OPEN_RATE_LIMIT_WINDOW_MS,
  })
  if (limitedResponse) return limitedResponse

  if (activeStreams >= ACTIVITY_STREAM_MAX_CONCURRENT_CONNECTIONS) {
    return NextResponse.json(
      { success: false, error: '连接数已达上限，请稍后再试' },
      { status: 503 },
    )
  }

  if (!(await isSiteLockSatisfied())) {
    return NextResponse.json({ success: false, error: '页面已锁定' }, { status: 403 })
  }

  activeStreams++

  const clientId = nextClientId++
  let clientRef: StreamClient | null = null

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const client: StreamClient = {
        id: clientId,
        controller,
        idleCloseTimer: null,
        closed: false,
      }
      clientRef = client
      clients.set(client.id, client)
      bumpClientIdleLease(client)
      const pushedCachedSnapshot = await pushCachedSnapshotToClient(client)
      ensureBroadcasterRunning({ skipImmediatePush: pushedCachedSnapshot })
    },
    cancel() {
      if (clientRef) closeClient(clientRef)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
