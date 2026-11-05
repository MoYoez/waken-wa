import {
  STATUS_CARD_SIGNATURE_WIDTH,
} from '@/constants/status-card'
import { getReportedScreenState } from '@/lib/lockapp-reporter'
import type { ScheduleOccurrence } from '@/lib/schedule-courses'
import {
  getInClassStatusLine,
  getMediaLine,
  getStatusLine,
  getSteamGameName,
} from '@/lib/status-card-activity'
import {
  estimateTextUnits,
  getTrimmedText,
} from '@/lib/status-card-text'
import type { ActivityFeedItem } from '@/types/activity'
import type {
  StatusCardIcon,
  StatusCardOptions,
  StatusCardProfile,
  StatusCardRenderLines,
  StatusCardState,
} from '@/types/status-card'

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function getDeviceType(
  deviceName: string,
  metadata: Record<string, unknown> | null | undefined,
): Extract<StatusCardIcon, 'desktop' | 'mobile' | 'tablet'> {
  const explicit = String(metadata?.deviceType ?? '').trim().toLowerCase()

  switch (explicit) {
    case 'mobile':
    case 'tablet':
    case 'desktop':
      return explicit
  }

  const source = deviceName.toLowerCase()
  if (/ipad|tablet|tab|平板/.test(source)) return 'tablet'
  if (/iphone|android|mobile|phone|手机/.test(source)) return 'mobile'
  return 'desktop'
}

function getFallbackDeviceLine(state: StatusCardState): string {
  switch (state) {
    case 'locked':
      return 'Unlock the site to view this card'
    case 'disabled':
      return 'Enable the status card in admin settings'
    case 'active':
    case 'empty':
      return 'Waiting for the next activity report'
  }
}

function estimateStatusCardWidth(
  texts: string[],
  minWidth: number,
  maxWidth: number,
  basePadding: number,
  pixelsPerUnit: number,
): number {
  const widest = texts.reduce((max, text) => Math.max(max, estimateTextUnits(text) * pixelsPerUnit), 0)
  return clampNumber(Math.round(widest + basePadding), minWidth, maxWidth)
}

function getStatusIcon(
  state: StatusCardState,
  activity: ActivityFeedItem | null,
  statusLine: string,
): StatusCardIcon | null {
  if (state === 'locked') return 'lock'
  if (state === 'empty') return 'hourglass'
  if (state !== 'active' || !activity) return null
  if (activity.isCustomLockStatus) return 'lock'
  const screenState = getReportedScreenState(activity.metadata)
  if (screenState === 'locked') return 'lock'
  if (screenState === 'inactive') return 'hourglass'
  if (!activity.isCustomOfflineStatus) return null

  const source = statusLine.toLowerCase()
  if (/待机|暂离|离开|idle|standby|away|afk/.test(source)) return 'hourglass'
  if (/休眠|睡觉|睡眠|睡了|晚安|sleep|sleeping|asleep|hibernate/.test(source)) return 'moon'
  return 'moon'
}

export function resolveStatusCardRenderLines({
  options,
  activity,
  state,
  inClassStatusActive = false,
  inClassOccurrence = null,
}: {
  options: StatusCardOptions
  activity: ActivityFeedItem | null
  state: StatusCardState
  inClassStatusActive?: boolean
  inClassOccurrence?: ScheduleOccurrence | null
}): StatusCardRenderLines {
  const isActive = state === 'active'
  const steamLine = isActive ? getSteamGameName(activity) : ''
  const appLine = isActive ? getStatusLine(activity) : ''
  const shouldPrioritizeGame = Boolean(options.preferGame && steamLine)
  const shouldUseInClassStatus = Boolean(
    inClassStatusActive &&
    options.showInClassStatus &&
    isActive,
  )
  let statusLine: string

  switch (state) {
    case 'locked':
      statusLine = 'Status locked'
      break
    case 'disabled':
      statusLine = 'Status card disabled'
      break
    case 'active':
      statusLine = shouldUseInClassStatus
        ? getInClassStatusLine(inClassOccurrence)
        : shouldPrioritizeGame
          ? steamLine
          : appLine
      break
    case 'empty':
      statusLine = 'No active status'
      break
  }

  const deviceLine = isActive && activity
    ? shouldPrioritizeGame
      ? `Steam · ${getTrimmedText(activity.device, 'Unknown device')}`
      : getTrimmedText(activity.device, 'Unknown device')
    : getFallbackDeviceLine(state)
  const mediaLine = isActive ? getMediaLine(activity) : ''

  return {
    steamLine,
    statusLine,
    deviceLine,
    mediaLine,
    shouldPrioritizeGame,
    shouldUseInClassStatus,
  }
}

export function resolveStatusCardAutoDimensions(
  options: StatusCardOptions,
  profile: StatusCardProfile,
  activity: ActivityFeedItem | null,
  state: StatusCardState,
  inClassStatusActive = false,
  inClassOccurrence: ScheduleOccurrence | null = null,
): Pick<StatusCardOptions, 'width' | 'height'> {
  if (!options.widthAuto && !options.heightAuto) {
    return { width: options.width, height: options.height }
  }

  const {
    steamLine,
    statusLine,
    deviceLine,
    mediaLine,
  } = resolveStatusCardRenderLines({
    options,
    activity,
    state,
    inClassStatusActive,
    inClassOccurrence,
  })
  const bio = getTrimmedText(profile.bio)
  const note = getTrimmedText(profile.note)
  const name = getTrimmedText(profile.name || 'Waken')
  const commonTexts = [name, bio, note, statusLine, deviceLine, mediaLine, steamLine]

  let width = options.width
  let height = options.height

  switch (options.variant) {
    case 'signature':
      width = STATUS_CARD_SIGNATURE_WIDTH
      height = options.heightAuto ? 0 : options.height
      return { width, height }
    case 'cover':
      if (options.widthAuto) {
        width = estimateStatusCardWidth(commonTexts, 320, 1200, 180, 8.2)
      }
      height = options.heightAuto ? 0 : options.height
      return { width, height }
    case 'aurora':
      if (options.widthAuto) {
        width = estimateStatusCardWidth(commonTexts, 320, 1200, 160, 8.4)
      }
      height = options.heightAuto ? 0 : options.height
      return { width, height }
    case 'classic':
      if (options.widthAuto) {
        width = estimateStatusCardWidth(commonTexts, 280, 1200, 140, 8.8)
      }
      height = options.heightAuto ? 0 : options.height
      return { width, height }
  }
}

export function getInitials(name: string): string {
  const normalized = getTrimmedText(name, 'W')
  const parts = normalized.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase()
  return normalized.slice(0, 2).toUpperCase()
}

export function getSectionTitle(state: StatusCardState, fallback: string): string {
  switch (state) {
    case 'locked':
      return 'PRIVATE STATUS'
    case 'disabled':
      return 'STATUS CARD'
    case 'active':
    case 'empty':
      return fallback
  }
}

export function getDisplayStatusIcon({
  state,
  activity,
  statusLine,
  shouldPrioritizeGame,
  shouldUseInClassStatus,
  inactiveFallback = null,
}: {
  state: StatusCardState
  activity: ActivityFeedItem | null
  statusLine: string
  shouldPrioritizeGame: boolean
  shouldUseInClassStatus: boolean
  inactiveFallback?: StatusCardIcon | null
}): StatusCardIcon | null {
  if (shouldUseInClassStatus) return 'bookOpen'
  if (shouldPrioritizeGame) return 'gamepad'
  return getStatusIcon(state, activity, statusLine) ?? (state === 'active' ? 'app' : inactiveFallback)
}

export function getDisplayDeviceIcon(
  state: StatusCardState,
  deviceLine: string,
  activity: ActivityFeedItem | null,
): Extract<StatusCardIcon, 'desktop' | 'mobile' | 'tablet'> {
  return state === 'active'
    ? getDeviceType(deviceLine, activity?.metadata)
    : 'desktop'
}
