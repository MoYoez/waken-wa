import 'server-only'

import { getColors, getPalette } from 'colorlip/sharp'

import {
  buildThemePaletteStats,
  buildThemeSurfaceFromPalette,
  COLORLIP_EXTRACT_OPTIONS,
} from '@/lib/theme-image-palette-core'
import type { ThemeCustomSurfaceFields } from '@/types/theme'

export async function extractThemeSurfaceFromImageBuffer(
  source: Buffer | Uint8Array,
  seedImageUrl: string,
): Promise<Partial<ThemeCustomSurfaceFields>> {
  const [colors, palette] = await Promise.all([
    getColors(source, COLORLIP_EXTRACT_OPTIONS),
    getPalette(source, COLORLIP_EXTRACT_OPTIONS),
  ])

  const stats = buildThemePaletteStats(colors, palette)
  return buildThemeSurfaceFromPalette(stats, seedImageUrl)
}
