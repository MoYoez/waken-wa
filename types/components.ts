import type { ComponentType, ReactNode } from 'react'

import type { UserNoteHitokotoEncode } from './hitokoto'

export interface SetupInitialConfig {
  pageTitle?: string
  userName: string
  userBio: string
  avatarUrl: string
  userNote: string
  historyWindowMinutes: number
  currentlyText: string
  earlierText: string
  adminText: string
}

export interface UserProfileNoteSectionProps {
  note?: string
  noteHitokotoEnabled?: boolean
  noteHitokotoCategories?: string[]
  noteHitokotoEncode?: UserNoteHitokotoEncode
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
