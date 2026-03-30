const HEX6 = /^#[0-9A-Fa-f]{6}$/

/** Validated #RRGGBB or null (empty / invalid). */
export function normalizeProfileOnlineAccentColor(raw: unknown): string | null {
  const s = typeof raw === 'string' ? raw.trim() : ''
  if (!s) return null
  if (!HEX6.test(s)) return null
  return s.toUpperCase()
}

/** CSS custom property name set on the avatar wrapper when a custom online accent is active. */
export const PROFILE_ONLINE_ACCENT_VAR = '--ProfileOnlineAccent' as const
