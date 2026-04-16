'use client'

import { CircleHelp } from 'lucide-react'
import Link from 'next/link'
import { useT } from 'next-i18next/client'
import { useState } from 'react'
import { TiWeatherCloudy } from 'react-icons/ti'

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

export function LayoutFooter({
  adminText,
  userName,
}: {
  adminText: string
  userName: string
}) {
  const { t } = useT('common')
  const isMobile = useIsMobile()
  const currentYear = new Date().getFullYear()
  const [poweredWaveTick, setPoweredWaveTick] = useState(0)
  const { count: viewerCount, error, loading } = useViewerCount({ mode: 'heartbeat' })
  const isPresenceConnected = !error && !loading
  const watchingSuffix = t('site.footer.watchingSuffix')
  const presenceStatus = error
    ? t('site.footer.presenceFailed')
    : loading
      ? t('site.footer.presenceSyncing')
      : t('site.footer.presenceConnected')
  const triggerPoweredWave = () => {
    setPoweredWaveTick((current) => current + 1)
  }
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
            className={`footer-presence-indicator ${isPresenceConnected ? 'is-connected' : 'is-disconnected'} inline-flex h-1.5 w-1.5 shrink-0 rounded-full`}
          />
          <span className={`font-medium ${isPresenceConnected ? 'text-emerald-300' : 'text-rose-300'}`}>
            {presenceStatus}
          </span>
        </span>
      </p>
      {error ? <p>{error}</p> : null}
    </div>
  )
  const renderViewerPresence = () => (
    <>
      <span
        aria-hidden
        className={`footer-presence-indicator ${isPresenceConnected ? 'is-connected' : 'is-disconnected'}`}
      />
      <span className="min-w-0 flex-1 cursor-default leading-none">
        <span className="inline-flex max-w-full items-center gap-1 truncate">
          <span className="truncate">{t('site.footer.watchingPrefix')}</span>
          <span className="shrink-0 tabular-nums font-medium text-foreground/88">{viewerCount}</span>
          {watchingSuffix ? <span className="shrink-0">{watchingSuffix}</span> : null}
        </span>
      </span>
      {isMobile ? (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex h-5 w-5 items-center justify-center rounded-md text-foreground/65 transition-colors hover:text-foreground"
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
              className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-md text-foreground/65 transition-colors hover:text-foreground"
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
    </>
  )

  return (
    <footer className="layout-footer public-page-font-scope pointer-events-none pb-4 sm:pb-6">
      <div className="pointer-events-auto mx-auto max-w-2xl px-4 sm:px-6">
        <div className="footer-surface overflow-hidden rounded-[20px] text-card-foreground sm:rounded-[24px]">
          <div className="footer-text-soft flex flex-col items-center gap-2 px-4 py-4 text-xs sm:px-5 sm:py-4">
            <div className="w-full space-y-2">
              <div className="footer-actions-row grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-[11px] leading-5 sm:text-xs">
                <div className="flex min-w-0 items-center justify-self-start gap-2">
                  <Link
                    href="/admin"
                    className="footer-text-soft inline-flex min-h-10 items-center justify-center gap-1.5 rounded-md px-1 py-2 font-medium transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 sm:min-h-0 sm:py-1"
                  >
                    <TiWeatherCloudy className="h-[15px] w-[15px] shrink-0 opacity-75" aria-hidden />
                    <span>{adminText}</span>
                  </Link>
                </div>

                <div
                  className="footer-text-soft inline-flex max-w-full items-center justify-self-end gap-1.5"
                  aria-live="polite"
                >
                  {renderViewerPresence()}
                </div>
              </div>

              <div aria-hidden className="footer-divider-line h-px w-full" />

              <div className="footer-actions-row grid w-full grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-3 text-[11px] sm:text-xs">
                <p className="footer-text-soft justify-self-start whitespace-nowrap">
                  © 2025 - {currentYear} {userName ? `${userName}` : ''}
                </p>
                <p className="footer-text-soft justify-self-end whitespace-nowrap text-right">
                  <span
                    className="footer-powered-signature inline-flex items-center gap-0.5 align-middle"
                    onMouseEnter={triggerPoweredWave}
                    onTouchStart={triggerPoweredWave}
                    onFocusCapture={triggerPoweredWave}
                  >
                    <span>Powered By</span>
                    <span
                      aria-hidden
                      key={`footer-caret-left-${poweredWaveTick}`}
                      className={`footer-powered-caret footer-powered-caret-left${poweredWaveTick > 0 ? ' is-waving' : ''}`}
                    >
                      ^
                    </span>
                    <a
                      target="_blank"
                      rel="noopener noreferrer"
                      className="footer-text-soft inline-flex min-h-10 items-center justify-center rounded-md px-1 py-2 font-medium transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 sm:min-h-0 sm:py-1"
                      href={TEMPLATE_REPO_HREF}
                    >
                      Waken-Wa
                    </a>
                    <span
                      aria-hidden
                      key={`footer-caret-right-${poweredWaveTick}`}
                      className={`footer-powered-caret footer-powered-caret-right${poweredWaveTick > 0 ? ' is-waving' : ''}`}
                    >
                      ^
                    </span>
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
