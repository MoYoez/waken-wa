import Link from 'next/link'
import { redirect } from 'next/navigation'

import { getOutboundTarget } from '@/lib/external-link'

export const dynamic = 'force-dynamic'

export default async function OutboundPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const targetParam = params.target
  const rawTarget = typeof targetParam === 'string' ? targetParam : Array.isArray(targetParam) ? targetParam[0] ?? '' : ''
  const target = getOutboundTarget(rawTarget)

  if (!target) {
    redirect('/')
  }

  return (
    <main className="min-h-screen bg-background px-4 py-16 text-foreground">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-5 rounded-3xl border border-border/70 bg-card/95 p-6 shadow-sm backdrop-blur">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
            外部链接
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            你即将离开本站
          </h1>
          <p className="text-sm leading-6 text-muted-foreground">
            你将要访问的是第三方页面。请先仔细确认目标链接；该页面的内容、隐私政策与安全性均不由本站负责。
          </p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-muted/40 p-4">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            目标地址
          </p>
          <p className="mt-2 break-all font-mono text-sm leading-6 text-foreground">
            {target}
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <a
            href={target}
            rel="noopener noreferrer nofollow"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            继续前往
          </a>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-background px-5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            返回上一页
          </Link>
        </div>
      </div>
    </main>
  )
}
