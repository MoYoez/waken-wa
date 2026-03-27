/** Hitokoto v1 sentence API (https://developer.hitokoto.cn). */

export const HITOKOTO_API_V1 = 'https://v1.hitokoto.cn'

export const HITOKOTO_CATEGORY_OPTIONS: { id: string; label: string }[] = [
  { id: 'a', label: '动画' },
  { id: 'b', label: '漫画' },
  { id: 'c', label: '游戏' },
  { id: 'd', label: '文学' },
  { id: 'e', label: '原创' },
  { id: 'f', label: '来自网络' },
  { id: 'g', label: '其他' },
  { id: 'h', label: '影视' },
  { id: 'i', label: '诗词' },
  { id: 'j', label: '网易云' },
  { id: 'k', label: '哲学' },
  { id: 'l', label: '抖机灵' },
]

const CATEGORY_IDS = new Set(HITOKOTO_CATEGORY_OPTIONS.map((o) => o.id))

export type UserNoteHitokotoEncode = 'json' | 'text'

export function normalizeHitokotoCategories(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const x of raw) {
    const c = String(x ?? '')
      .trim()
      .toLowerCase()
    if (!CATEGORY_IDS.has(c) || seen.has(c)) continue
    seen.add(c)
    out.push(c)
  }
  return out
}

export function normalizeHitokotoEncode(raw: unknown): UserNoteHitokotoEncode {
  return raw === 'text' ? 'text' : 'json'
}

/** Build GET URL with `encode` and repeated `c` params. Empty categories = any type. */
export function buildHitokotoRequestUrl(
  categories: string[],
  encode: UserNoteHitokotoEncode,
): string {
  const u = new URL(HITOKOTO_API_V1)
  u.searchParams.set('encode', encode)
  for (const c of categories) {
    if (CATEGORY_IDS.has(c)) u.searchParams.append('c', c)
  }
  return u.toString()
}

export type HitokotoJsonBody = {
  hitokoto?: string
  uuid?: string
}
