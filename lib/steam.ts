/** Steam Web API (GetPlayerSummaries). Keys: SiteConfig or STEAM_API_KEY. @see https://developer.valvesoftware.com/wiki/Steam_Web_API */

import type {
  SteamNowPlayingInfo,
  SteamPersonaState,
  SteamPlayerStatus,
  SteamStatusResponse,
} from '@/types/steam'

export type {
  SteamNowPlayingInfo,
  SteamPersonaState,
  SteamPlayerStatus,
  SteamStatusResponse,
} from '@/types/steam'

const STEAM_APP_HEADER_CDN = 'https://cdn.cloudflare.steamstatic.com/steam/apps'

export function steamAppHeaderImageUrl(appId: string): string {
  const id = String(appId || '').trim()
  return `${STEAM_APP_HEADER_CDN}/${encodeURIComponent(id)}/header.jpg`
}

const PERSONA_STATE_MAP: Record<number, SteamPersonaState> = {
  0: 'offline',
  1: 'online',
  2: 'busy',
  3: 'away',
  4: 'snooze',
  5: 'lookingToTrade',
  6: 'lookingToPlay',
}

export const PERSONA_STATE_LABELS: Record<SteamPersonaState, string> = {
  offline: '离线',
  online: '在线',
  busy: '忙碌',
  away: '离开',
  snooze: '打盹',
  lookingToTrade: '想交易',
  lookingToPlay: '想玩游戏',
}

/**
 * Fetch player status from Steam Web API
 */
export async function fetchSteamPlayerStatus(
  steamId: string,
  apiKey: string
): Promise<SteamStatusResponse> {
  if (!steamId || !apiKey) {
    return { success: false, error: '缺少 Steam ID 或 API Key' }
  }

  try {
    const url = new URL('https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/')
    url.searchParams.set('key', apiKey)
    url.searchParams.set('steamids', steamId)

    const response = await fetch(url.toString(), {
      next: { revalidate: 60 }, // Cache for 60 seconds
    })

    if (!response.ok) {
      return { success: false, error: `Steam API 返回错误: ${response.status}` }
    }

    const data = await response.json()
    const players = data?.response?.players

    if (!players || players.length === 0) {
      return { success: false, error: '未找到玩家信息' }
    }

    const player = players[0]
    if (!player || typeof player !== 'object') {
      return { success: false, error: '未找到玩家信息' }
    }

    return {
      success: true,
      data: parseSteamPlayer(player as Record<string, unknown>),
    }
  } catch (error) {
    console.error('Steam API 请求失败:', error)
    return { success: false, error: '无法连接到 Steam API' }
  }
}

function parseSteamPlayer(player: Record<string, unknown>): SteamPlayerStatus {
  const personaStateNum = Number(player.personastate ?? 0)
  return {
    steamId: String(player.steamid ?? ''),
    personaName: String(player.personaname ?? ''),
    personaState: PERSONA_STATE_MAP[personaStateNum] || 'offline',
    avatarUrl: String(player.avatarmedium || player.avatar || ''),
    profileUrl: String(player.profileurl ?? ''),
    gameExtraInfo: player.gameextrainfo ? String(player.gameextrainfo) : null,
    gameId: player.gameid ? String(player.gameid) : null,
    lastLogoff: typeof player.lastlogoff === 'number' ? player.lastlogoff : undefined,
  }
}

/** True when Steam reports a non-empty game name and app id and the user is not offline. */
export function isSteamShowingInGame(player: SteamPlayerStatus): boolean {
  const name = (player.gameExtraInfo || '').trim()
  const gid = (player.gameId || '').trim()
  if (!name || !gid || gid === '0') return false
  return player.personaState !== 'offline'
}

export function steamPlayerToNowPlaying(player: SteamPlayerStatus): SteamNowPlayingInfo | null {
  if (!isSteamShowingInGame(player)) return null
  const appId = String(player.gameId || '').trim()
  const name = String(player.gameExtraInfo || '').trim()
  return {
    appId,
    name,
    imageUrl: steamAppHeaderImageUrl(appId),
  }
}

const MAX_STEAM_IDS_PER_REQUEST = 100

/**
 * Batch fetch player summaries (one HTTP call per chunk of up to 100 IDs).
 */
export async function fetchSteamPlayersByIds(
  steamIds: string[],
  apiKey: string
): Promise<Map<string, SteamPlayerStatus>> {
  const out = new Map<string, SteamPlayerStatus>()
  const unique = [...new Set(steamIds.map((id) => String(id || '').trim()).filter(Boolean))]
  if (unique.length === 0 || !apiKey) return out

  for (let i = 0; i < unique.length; i += MAX_STEAM_IDS_PER_REQUEST) {
    const chunk = unique.slice(i, i + MAX_STEAM_IDS_PER_REQUEST)
    try {
      const url = new URL('https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/')
      url.searchParams.set('key', apiKey)
      url.searchParams.set('steamids', chunk.join(','))

      const response = await fetch(url.toString(), {
        next: { revalidate: 60 },
      })

      if (!response.ok) continue

      const data = await response.json()
      const players = data?.response?.players
      if (!Array.isArray(players)) continue

      for (const raw of players) {
        if (!raw || typeof raw !== 'object') continue
        const p = parseSteamPlayer(raw as Record<string, unknown>)
        if (p.steamId) out.set(p.steamId, p)
      }
    } catch (error) {
      console.error('Steam batch API 请求失败:', error)
    }
  }

  return out
}

/**
 * Validate Steam ID format (64-bit ID)
 */
export function isValidSteamId(steamId: string): boolean {
  // Steam 64-bit ID is 17 digits starting with 7656
  return /^7656\d{13}$/.test(steamId)
}
