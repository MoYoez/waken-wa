'use client'

import { ArrowUpRight, CircleHelp } from 'lucide-react'
import Link from 'next/link'
import { useT } from 'next-i18next/client'

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useIsMobile } from '@/components/ui/use-mobile'
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
  const { t } = useT('common')
  const isMobile = useIsMobile()
  const nowYear = new Date().getFullYear()
  const { count: viewerCount, error, loading } = useViewerCount({ mode: 'heartbeat' })
  const watchingSuffix = t('site.footer.watchingSuffix')
  const presenceStatus = error
    ? t('site.footer.presenceFailed')
    : loading
      ? t('site.footer.presenceSyncing')
      : t('site.footer.presenceConnected')
  const helpBody = (
    <div className="space-y-2 text-left">
      <p className="font-medium">{t('site.footer.helpTitle')}</p>
      <p>
        {t('site.footer.helpLine1Prefix')}
        <code className="mx-1 rounded bg-background/20 px-1">/api/viewers</code>
        {t('site.footer.helpLine1Suffix')}
      </p>
      <p>{t('site.footer.helpLine2')}</p>
      <p>
        {t('site.footer.helpStatusLabel')}
        <span className="ml-1 inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className={`inline-flex h-1.5 w-1.5 shrink-0 rounded-full ${error ? 'bg-amber-300' : 'bg-emerald-400'} ${loading ? 'animate-pulse' : ''}`}
          />
          <span className={`font-medium ${error ? 'text-amber-300' : 'text-emerald-300'}`}>
            {presenceStatus}
          </span>
        </span>
      </p>
      {error ? <p>{error}</p> : null}
    </div>
  )

  return (
    <footer className="layout-footer public-page-font-scope pointer-events-none pb-4 sm:pb-6">
      <div className="pointer-events-auto mx-auto max-w-2xl px-4 sm:px-6">
        <div className="footer-surface overflow-hidden rounded-[20px] text-card-foreground sm:rounded-[24px]">
          <div className="flex flex-col items-center gap-1.5 px-4 py-4 text-xs text-muted-foreground sm:gap-2 sm:px-5 sm:py-4">
            <div className="footer-actions-row flex flex-wrap items-center justify-center gap-x-3 gap-y-2 sm:gap-x-4">
              <Link
                href="/admin"
                className="inline-flex min-h-10 items-center justify-center rounded-md px-1 py-2 text-sm font-medium text-muted-foreground/62 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 sm:min-h-0 sm:py-1"
              >
                {adminText}
              </Link>

              <span aria-hidden className="hidden h-1 w-1 rounded-full bg-border/75 sm:inline-block" />

              <div
                className="inline-flex max-w-full items-center gap-1.5 text-xs text-muted-foreground/62"
                aria-live="polite"
              >
                <span className="min-w-0 flex-1 cursor-default leading-none">
                  <span className="inline-flex max-w-full items-center gap-1 truncate">
                    <span className="truncate">{t('site.footer.watchingPrefix')}</span>
                    <span className="shrink-0 tabular-nums font-medium text-foreground/88">
                      {viewerCount}
                    </span>
                    {watchingSuffix ? <span className="shrink-0">{watchingSuffix}</span> : null}
                  </span>
                </span>
                {isMobile ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground/62 transition-colors hover:text-foreground"
                        aria-label={t('site.footer.helpAriaLabel')}
                      >
                        <CircleHelp className="h-3 w-3" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      side="top"
                      align="start"
                      className="w-[min(20rem,calc(100vw-2rem))] p-3 text-xs text-muted-foreground"
                    >
                      {helpBody}
                    </PopoverContent>
                  </Popover>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-md text-muted-foreground/62 transition-colors hover:text-foreground"
                        aria-label={t('site.footer.helpAriaLabel')}
                      >
                        <CircleHelp className="h-3 w-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" align="start" className="max-w-xs space-y-2 p-3 text-left">
                      {helpBody}
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>

            <div className="footer-actions-row flex flex-wrap items-center justify-center gap-x-3 gap-y-2 sm:gap-x-4">
              <p className="text-[11px] text-muted-foreground/58 sm:text-xs sm:whitespace-nowrap">
                © 2025{nowYear > 2025 ? ` - ` : ' '}
                <span suppressHydrationWarning>{nowYear > 2025 ? nowYear : ''}</span>
                {nowYear > 2025 ? ' ' : ''}
                Powered By Waken-Wa
              </p>

              <span aria-hidden className="hidden h-1 w-1 rounded-full bg-border/75 sm:inline-block" />

              <a
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-md px-1 py-2 font-medium text-muted-foreground/72 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 sm:min-h-0 sm:py-1"
                href={TEMPLATE_REPO_HREF}
              >
                <GitHubMark />
                <span>{t('site.footer.forkProject')}</span>
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
