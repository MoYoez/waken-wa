import type { ComponentType, ReactNode } from 'react'

import type { UserNoteHitokotoEncode } from './hitokoto'

export interface SetupInitialConfig {
  pageTitle?: string
  userName: string
  userBio: string
  avatarUrl: string
  avatarFetchByServerEnabled?: boolean
  userNote: string
  historyWindowMinutes: number
  currentlyText: string
  earlierText: string
  adminText: string
}

export interface UserProfileNoteSectionProps {
  note?: string
  avatarUrl?: string
  noteHitokotoEnabled?: boolean
  noteTypewriterEnabled?: boolean
  noteSignatureFontEnabled?: boolean
  noteSignatureFontFamily?: string
  noteHitokotoCategories?: string[]
  noteHitokotoEncode?: UserNoteHitokotoEncode
  noteHitokotoFallbackToNote?: boolean
}

export type ImageCropAspectMode = 'square' | 'free'

export interface ImageCropDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sourceUrl: string | null
  outputSize: number
  aspectMode?: ImageCropAspectMode
  title: string
  description?: string
  onComplete: (dataUrl: string) => void
}

export type InspirationHomeItem = {
  id: number
  title: string | null
  content: string
  contentLexical?: string | null
  imageDataUrl: string | null
  statusSnapshot: string | null
  createdAt: string
  displayTimezone?: string
}

export type ChartConfig = {
  [k in string]: {
    label?: ReactNode
    icon?: ComponentType
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<'light' | 'dark', string> }
  )
}
