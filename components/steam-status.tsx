'use client'

import { useEffect, useState, useCallback } from 'react'
import { Gamepad2, User, ExternalLink } from 'lucide-react'
import { PERSONA_STATE_LABELS, type SteamPlayerStatus, type SteamPersonaState } from '@/lib/steam'

interface SteamStatusProps {
  /** Polling interval in milliseconds. Default: 60000 (60 seconds) */
  pollingInterval?: number
}

function getStatusColor(state: SteamPersonaState, isInGame: boolean): string {
  if (isInGame) return 'bg-green-500'
  switch (state) {
    case 'online':
    case 'lookingToPlay':
    case 'lookingToTrade':
      return 'bg-blue-500'
    case 'away':
    case 'snooze':
      return 'bg-yellow-500'
    case 'busy':
      return 'bg-red-500'
    default:
      return 'bg-muted-foreground/50'
  }
}

function getStatusText(state: SteamPersonaState, gameName: string | null): string {
  if (gameName) {
    return `正在游玩 ${gameName}`
  }
  return PERSONA_STATE_LABELS[state] || '离线'
}

export function SteamStatus({ pollingInterval = 60000 }: SteamStatusProps) {
  const [status, setStatus] = useState<SteamPlayerStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/steam/status', { cache: 'no-store' })
      const data = await res.json()
      
      if (data.success && data.data) {
        setStatus(data.data)
        setError(null)
      } else if (res.status === 404) {
        // Steam not enabled or not configured - silently hide
        setStatus(null)
        setError(null)
      } else {
        setError(data.error || '获取 Steam 状态失败')
      }
    } catch {
      setError('无法连接服务器')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return

    fetchStatus()
    const timer = setInterval(fetchStatus, pollingInterval)
    return () => clearInterval(timer)
  }, [mounted, fetchStatus, pollingInterval])

  // Don't render anything until mounted
  if (!mounted || loading) return null

  // If Steam is not enabled or not configured, don't show anything
  if (!status && !error) return null

  // Show error state
  if (error) {
    return (
      <div className="border border-border rounded-lg shadow-sm p-5 sm:p-6 bg-card">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted">
            <Gamepad2 className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-foreground">Steam</div>
            <div className="text-xs text-destructive">{error}</div>
          </div>
        </div>
      </div>
    )
  }

  if (!status) return null

  const isInGame = !!status.gameExtraInfo
  const statusColor = getStatusColor(status.personaState, isInGame)
  const statusText = getStatusText(status.personaState, status.gameExtraInfo)

  return (
    <div className="border border-border rounded-lg shadow-sm p-5 sm:p-6 bg-card transition-all hover:shadow-md hover:border-primary/25">
      <div className="space-y-4">
        {/* Header with avatar and status */}
        <div className="flex items-center gap-3">
          <div className="relative">
            {status.avatarUrl ? (
              <img
                src={status.avatarUrl}
                alt={status.personaName}
                className="w-10 h-10 rounded-lg object-cover"
                crossOrigin="anonymous"
              />
            ) : (
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted">
                <User className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            {/* Status indicator */}
            <div 
              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card ${statusColor}`}
              title={PERSONA_STATE_LABELS[status.personaState]}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Gamepad2 className="h-4 w-4 shrink-0 text-primary/80" />
              <span className="text-sm font-medium text-foreground truncate">
                {status.personaName}
              </span>
            </div>
            <div className={`text-xs ${isInGame ? 'text-green-600 dark:text-green-400 font-medium' : 'text-muted-foreground'}`}>
              {statusText}
            </div>
          </div>
          {status.profileUrl && (
            <a
              href={status.profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="打开 Steam 个人资料"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>

        {/* Game info when playing */}
        {isInGame && status.gameExtraInfo && (
          <div className="rounded-md bg-green-500/10 dark:bg-green-500/5 border border-green-500/20 px-3 py-2.5">
            <div className="text-xs font-medium text-green-700 dark:text-green-400">
              {status.gameExtraInfo}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
