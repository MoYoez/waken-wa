/**
 * Steam Web API integration
 * 
 * Uses the ISteamUser/GetPlayerSummaries API to get player status.
 * API Key should be stored in STEAM_API_KEY environment variable.
 * 
 * @see https://developer.valvesoftware.com/wiki/Steam_Web_API
 */

export type SteamPersonaState = 
  | 'offline'      // 0
  | 'online'       // 1
  | 'busy'         // 2
  | 'away'         // 3
  | 'snooze'       // 4
  | 'lookingToTrade' // 5
  | 'lookingToPlay'  // 6

export interface SteamPlayerStatus {
  steamId: string
  personaName: string
  personaState: SteamPersonaState
  avatarUrl: string
  profileUrl: string
  /** Currently playing game name, null if not in-game */
  gameExtraInfo: string | null
  /** Currently playing game ID, null if not in-game */
  gameId: string | null
  /** Last logoff timestamp (Unix) */
  lastLogoff?: number
}

export interface SteamStatusResponse {
  success: boolean
  data?: SteamPlayerStatus
  error?: string
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
    const personaStateNum = player.personastate ?? 0

    return {
      success: true,
      data: {
        steamId: player.steamid,
        personaName: player.personaname,
        personaState: PERSONA_STATE_MAP[personaStateNum] || 'offline',
        avatarUrl: player.avatarmedium || player.avatar,
        profileUrl: player.profileurl,
        gameExtraInfo: player.gameextrainfo || null,
        gameId: player.gameid || null,
        lastLogoff: player.lastlogoff,
      },
    }
  } catch (error) {
    console.error('Steam API 请求失败:', error)
    return { success: false, error: '无法连接到 Steam API' }
  }
}

/**
 * Validate Steam ID format (64-bit ID)
 */
export function isValidSteamId(steamId: string): boolean {
  // Steam 64-bit ID is 17 digits starting with 7656
  return /^7656\d{13}$/.test(steamId)
}
