import { NextResponse } from 'next/server'

import { ACTIVITY_FEED_DEFAULT_LIMIT } from '@/lib/activity-api-constants'
import { getActivityFeedData } from '@/lib/activity-feed'
import { isSiteLockSatisfied } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

const MAX_CONCURRENT_STREAMS = 50
/** Max time without a successful push; resets on each push (sliding lease). */
const MAX_STREAM_IDLE_MS = 600 * 1000 // 10mins
const POLL_INTERVAL_MS = 15 * 1000 // 15 秒轮询间隔
/** Close stream after this many consecutive failed activity fetches (link treated as dead). */
const MAX_CONSECUTIVE_PUSH_FAILURES = 3

let activeStreams = 0

function toSseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

export async function GET() {
  if (activeStreams >= MAX_CONCURRENT_STREAMS) {
    return NextResponse.json(
      { success: false, error: '连接数已达上限，请稍后再试' },
      { status: 503 },
    )
  }

  if (!(await isSiteLockSatisfied())) {
    return NextResponse.json({ success: false, error: '页面已锁定' }, { status: 403 })
  }

  activeStreams++

  const encoder = new TextEncoder()
  let timer: ReturnType<typeof setInterval> | null = null
  let idleCloseTimer: ReturnType<typeof setTimeout> | null = null
  let closed = false
  let consecutivePushFailures = 0

  const cleanup = () => {
    if (timer) { clearInterval(timer); timer = null }
    if (idleCloseTimer) { clearTimeout(idleCloseTimer); idleCloseTimer = null }
    if (!closed) {
      closed = true
      activeStreams = Math.max(0, activeStreams - 1)
    }
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const bumpIdleLease = () => {
        if (closed) return
        if (idleCloseTimer) clearTimeout(idleCloseTimer)
        idleCloseTimer = setTimeout(() => {
          cleanup()
          try { controller.close() } catch { /* already closed */ }
        }, MAX_STREAM_IDLE_MS)
      }

      const safeEnqueue = (chunk: Uint8Array): boolean => {
        if (closed) return false
        try {
          controller.enqueue(chunk)
          return true
        } catch {
          cleanup()
          return false
        }
      }

      const push = async () => {
        if (closed) return
        try {
          const payload = await getActivityFeedData(ACTIVITY_FEED_DEFAULT_LIMIT)
          if (safeEnqueue(
            encoder.encode(
              toSseEvent('activity', { success: true, data: payload })
            )
          )) {
            consecutivePushFailures = 0
            bumpIdleLease()
          }
        } catch (error) {
          if (closed) return
          console.error('[activity stream] push failed:', error)
          consecutivePushFailures++
          if (consecutivePushFailures >= MAX_CONSECUTIVE_PUSH_FAILURES) {
            cleanup()
            try {
              controller.close()
            } catch {
              /* already closed */
            }
            return
          }
          if (safeEnqueue(
            encoder.encode(
              toSseEvent('error', {
                success: false,
                error: 'stream update failed',
              })
            )
          )) {
            bumpIdleLease()
          }
        }
      }

      bumpIdleLease()
      void push()
      timer = setInterval(() => {
        void push()
      }, POLL_INTERVAL_MS)
    },
    cancel() {
      cleanup()
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
