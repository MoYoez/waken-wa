/** Steam persona state (ISteamUser/GetPlayerSummaries). */
export type SteamPersonaState =
  | 'offline'
  | 'online'
  | 'busy'
  | 'away'
  | 'snooze'
  | 'lookingToTrade'
  | 'lookingToPlay'

export interface SteamPlayerStatus {
  steamId: string
  personaName: string
  personaState: SteamPersonaState
  avatarUrl: string
  profileUrl: string
  gameExtraInfo: string | null
  gameId: string | null
  lastLogoff?: number
}

export interface SteamStatusResponse {
  success: boolean
  data?: SteamPlayerStatus
  error?: string
}

/** Activity card: in-game info from Steam when enabled. */
export interface SteamNowPlayingInfo {
  appId: string
  name: string
  imageUrl: string
}
