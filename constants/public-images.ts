/** Tuned for the 64–80px home/list cards. Square cover crop avoids the off-axis pixel waste Lighthouse flags. */
export const INSPIRATION_LIST_IMAGE_OPTIONS = {
  fit: 'cover' as const,
  format: 'webp' as const,
  height: 180,
  quality: 60,
  width: 180,
} as const

/** Avatar in the home profile row. 96px source matches the 4.5rem display box. */
export const HOME_AVATAR_IMAGE_OPTIONS = {
  format: 'webp' as const,
  quality: 70,
  width: 96,
} as const
