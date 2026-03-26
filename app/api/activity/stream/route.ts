import { getActivityFeedData } from '@/lib/activity-feed'

export const runtime = 'nodejs'
// 强制动态渲染，禁用缓存
export const dynamic = 'force-dynamic'
export const revalidate = 0

function toSseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

export async function GET() {
  const encoder = new TextEncoder()
  let timer: ReturnType<typeof setInterval> | null = null
  let closed = false

  const cleanup = () => {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
    closed = true
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
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
          const payload = await getActivityFeedData(50)
          safeEnqueue(
            encoder.encode(
              toSseEvent('activity', { success: true, data: payload })
            )
          )
        } catch (error) {
          if (closed) return
          safeEnqueue(
            encoder.encode(
              toSseEvent('error', {
                success: false,
                error: 'stream update failed',
                detail: String(error),
              })
            )
          )
        }
      }

      void push()
      timer = setInterval(() => {
        void push()
      }, 5000)
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
