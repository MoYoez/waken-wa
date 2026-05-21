/** Shared visual constants for the user-profile note family of components. */
export const NOTE_BOX_CLASS =
  'block w-full min-w-0 max-w-full break-words text-sm font-semibold text-foreground leading-snug border-l-2 border-primary pl-4 pr-0'

export const NOTE_SIGNATURE_CLASS = 'text-[1.1rem] font-normal leading-[1.8]'

export const NOTE_SIGNATURE_FONT_STACK = 'Satisfy, var(--font-sans)'

export const HITOKOTO_TYPEWRITER_START_DELAY_MS = 420

export function resolveNoteFontFamily(
  enabled: boolean,
  overrideFontFamily?: string,
): string | undefined {
  if (!enabled) return undefined
  const override = String(overrideFontFamily ?? '').trim()
  return override || NOTE_SIGNATURE_FONT_STACK
}
