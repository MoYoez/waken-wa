export type ThemePreset =
  | 'basic'
  | 'midnight'
  | 'forest'
  | 'sakura'
  | 'obsidian'
  | 'ocean'
  | 'amber'
  | 'lavender'
  | 'mono'
  | 'nord'
  | 'customSurface'

export type ThemeCustomSurfaceFields = {
  background?: string
  bodyBackground?: string
  animatedBg?: string
  primary?: string
  secondary?: string
  accent?: string
  online?: string
  foreground?: string
  card?: string
  border?: string
  muted?: string
  mutedForeground?: string
  homeCardOverlay?: string
  homeCardOverlayDark?: string
  homeCardInsetHighlight?: string
  animatedBgTint1?: string
  animatedBgTint2?: string
  animatedBgTint3?: string
  floatingOrbColor1?: string
  floatingOrbColor2?: string
  floatingOrbColor3?: string
  radius?: string
  hideFloatingOrbs?: boolean
  transparentAnimatedBg?: boolean
}
