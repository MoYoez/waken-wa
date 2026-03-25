import { getActivityFeedData } from '@/lib/activity-feed'

export const runtime = 'nodejs'

function toSseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

export async function GET() {
  const encoder = new TextEncoder()
  let timer: ReturnType<typeof setInterval> | null = null

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const push = async () => {
        try {
          const payload = await getActivityFeedData(50)
          controller.enqueue(
            encoder.encode(
              toSseEvent('activity', { success: true, data: payload })
            )
          )
        } catch (error) {
          controller.enqueue(
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
      if (timer) clearInterval(timer)
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
