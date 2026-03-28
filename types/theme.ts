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
  foreground?: string
  card?: string
  border?: string
  mutedForeground?: string
  radius?: string
  hideFloatingOrbs?: boolean
  transparentAnimatedBg?: boolean
}
