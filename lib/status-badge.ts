import 'server-only'

import { ACTIVITY_FEED_DEFAULT_LIMIT } from '@/constants/activity-api'
import { getActivityFeedData } from '@/lib/activity-feed'
import {
  getMediaLine,
  getStatusLine,
  getSteamGameName,
} from '@/lib/status-card-activity'
import { escapeXml, truncateText } from '@/lib/status-card-text'

export type StatusBadgeData = {
  label: string
  message: string
  color: string
  isOnline: boolean
}

const BADGE_MESSAGE_MAX_CHARS = 42
const COLOR_ONLINE = '#22C55E'
const COLOR_OFFLINE = '#9CA3AF'

/**
 * Compose a single-line status summary for embeddable badges
 * (GitHub README, BBS signatures). Prefers game > media > status line.
 */
export async function GetStatusBadgeData(label = 'status'): Promise<StatusBadgeData> {
  const feed = await getActivityFeedData(ACTIVITY_FEED_DEFAULT_LIMIT, { forPublicFeed: true })
  const active = feed.activeStatuses?.[0] ?? null
  const isOnline = Boolean(active)

  let message = 'offline'
  if (active) {
    const game = getSteamGameName(active)
    const media = getMediaLine(active)
    message = game || media || getStatusLine(active)
  }

  return {
    label: label.trim() || 'status',
    message: truncateText(message || 'online', BADGE_MESSAGE_MAX_CHARS),
    color: isOnline ? COLOR_ONLINE : COLOR_OFFLINE,
    isOnline,
  }
}

/** Shields.io endpoint schema (https://shields.io/endpoint). */
export function ToShieldsEndpoint(data: StatusBadgeData): Record<string, unknown> {
  return {
    schemaVersion: 1,
    label: data.label,
    message: data.message,
    color: data.color,
  }
}

/** ~6px per character estimate for flat-badge width. */
function estimateBadgeTextWidth(text: string): number {
  let width = 0
  for (const char of text) {
    width += char.charCodeAt(0) > 0x2e80 ? 12 : 6.5
  }
  return Math.ceil(width)
}

/** Minimal flat SVG badge, self-contained (no external shields dependency). */
export function RenderStatusBadgeSvg(data: StatusBadgeData): string {
  const paddingX = 8
  const labelText = data.label
  const messageText = data.message
  const labelWidth = estimateBadgeTextWidth(labelText) + paddingX * 2
  const messageWidth = estimateBadgeTextWidth(messageText) + paddingX * 2
  const totalWidth = labelWidth + messageWidth
  const height = 20
  const labelCenter = labelWidth / 2
  const messageCenter = labelWidth + messageWidth / 2

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${height}" role="img" aria-label="${escapeXml(labelText)}: ${escapeXml(messageText)}">`,
    `<title>${escapeXml(labelText)}: ${escapeXml(messageText)}</title>`,
    `<linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>`,
    `<clipPath id="r"><rect width="${totalWidth}" height="${height}" rx="3" fill="#fff"/></clipPath>`,
    `<g clip-path="url(#r)">`,
    `<rect width="${labelWidth}" height="${height}" fill="#555"/>`,
    `<rect x="${labelWidth}" width="${messageWidth}" height="${height}" fill="${escapeXml(data.color)}"/>`,
    `<rect width="${totalWidth}" height="${height}" fill="url(#s)"/>`,
    `</g>`,
    `<g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">`,
    `<text x="${labelCenter}" y="15" fill="#010101" fill-opacity=".3">${escapeXml(labelText)}</text>`,
    `<text x="${labelCenter}" y="14">${escapeXml(labelText)}</text>`,
    `<text x="${messageCenter}" y="15" fill="#010101" fill-opacity=".3">${escapeXml(messageText)}</text>`,
    `<text x="${messageCenter}" y="14">${escapeXml(messageText)}</text>`,
    `</g>`,
    `</svg>`,
  ].join('')
}
