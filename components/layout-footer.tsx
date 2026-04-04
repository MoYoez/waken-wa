'use client'

import { ArrowUpRight, CircleHelp, Users } from 'lucide-react'
import Link from 'next/link'

import { ThemeModeToggle } from '@/components/theme-mode-toggle'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useViewerCount } from '@/hooks/use-viewer-count'

const TEMPLATE_REPO_HREF = 'https://github.com/MoYoez/waken-wa'

function GitHubMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      stroke="currentColor"
      fill="currentColor"
      strokeWidth={0}
      role="img"
      viewBox="0 0 24 24"
      aria-hidden
      height={14}
      width={14}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  )
}

export function LayoutFooter({ adminText }: { adminText: string }) {
  const { count: viewerCount, error, loading } = useViewerCount({ mode: 'heartbeat' })
  const presenceStatus = error ? '读取失败' : loading ? '同步中' : '已连接'

  return (
    <footer className="layout-footer px-4 pb-5 sm:px-6 sm:pb-8">
      <div className="mx-auto max-w-3xl">
        <div className="footer-surface overflow-hidden rounded-[20px] text-card-foreground sm:rounded-[24px]">
          <div className="flex flex-col gap-4 px-4 py-4 sm:px-5 sm:py-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div
                className="footer-presence-chip inline-flex w-full max-w-full items-center gap-2 rounded-2xl border border-border/60 bg-background/80 px-3 py-2 text-sm font-medium text-muted-foreground shadow-sm sm:w-auto sm:rounded-full sm:py-1.5"
                aria-live="polite"
              >
                <span className="relative flex h-2.5 w-2.5 shrink-0 items-center justify-center" aria-hidden>
                  <span
                    className={`absolute inline-flex h-full w-full rounded-full opacity-70 ${error ? 'bg-amber-400' : 'bg-emerald-500'} ${loading ? 'animate-pulse' : 'animate-ping'}`}
                  />
                  <span
                    className={`relative inline-flex h-2.5 w-2.5 rounded-full ${error ? 'bg-amber-400' : 'bg-emerald-500'}`}
                  />
                </span>
                <Users className="h-4 w-4 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1 cursor-default text-foreground">
                  正在被 <span className="tabular-nums text-primary">{viewerCount}</span> 人看爆
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
                      aria-label="查看在线人数说明"
                    >
                      <CircleHelp className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" align="start" className="max-w-xs space-y-2 p-3 text-left">
                    <p className="font-medium">这是如何实现的？</p>
                    <p>
                      当你打开这个页面时，浏览器会定时向
                      <code className="mx-1 rounded bg-background/20 px-1">/api/viewers</code>
                      发送 heartbeat，请求当前浏览页面的人数。
                    </p>
                    <p>
                      这个计数用于显示站点当前有多少访客正在查看页面；当前实现不是 WebSocket 推送，而是周期性同步。
                    </p>
                    <p>
                      当前状态：
                      <span className={`ml-1 font-medium ${error ? 'text-amber-300' : 'text-emerald-300'}`}>
                        {presenceStatus}
                      </span>
                    </p>
                    {error ? <p>{error}</p> : null}
                  </TooltipContent>
                </Tooltip>
              </div>

              <div className="hidden items-center justify-end sm:flex">
                <Link
                  href="/admin"
                  className="inline-flex min-h-10 items-center justify-center rounded-2xl border border-border/60 bg-background/80 px-3 py-2 text-sm font-medium text-muted-foreground shadow-sm transition-colors hover:bg-accent/60 hover:text-foreground sm:min-h-0 sm:rounded-full sm:py-1.5"
                >
                  {adminText}
                </Link>
              </div>
            </div>

            <div className="h-px bg-[linear-gradient(90deg,color-mix(in_srgb,var(--border)_0%,transparent),var(--border),color-mix(in_srgb,var(--border)_0%,transparent))]" />

            <div className="footer-actions-row grid gap-3 text-xs text-muted-foreground sm:flex sm:items-center sm:justify-between">
              <div className="flex items-center justify-stretch sm:justify-start">
                <a
                  target="_blank"
                  rel="noopener noreferrer"
                  className="footer-primary-action inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-2xl border border-primary/30 bg-primary px-3 py-2 font-medium text-primary-foreground transition-colors hover:bg-primary/90 sm:min-h-0 sm:w-auto sm:rounded-full sm:py-1.5"
                  href={TEMPLATE_REPO_HREF}
                >
                  <GitHubMark />
                  <span>Fork this Project</span>
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                </a>
              </div>

              <div className="flex items-center gap-3 sm:justify-end">
                <Link
                  href="/admin"
                  className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-2xl border border-border/60 bg-background/80 px-3 py-2 text-sm font-medium text-muted-foreground shadow-sm transition-colors hover:bg-accent/60 hover:text-foreground sm:hidden"
                >
                  {adminText}
                </Link>
                <ThemeModeToggle className="min-w-0 flex-1 justify-center sm:w-auto sm:flex-none" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
