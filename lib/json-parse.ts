export function parseJsonString(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw

  const trimmed = raw.trim()
  if (!trimmed) return raw

  try {
    return JSON.parse(trimmed)
  } catch {
    return raw
  }
}
