export type InspirationTokenGateResult =
  | { ok: true }
  | { ok: false; status: number; error: string }

export type LexicalNode = {
  type?: string
  text?: string
  format?: number
  tag?: string
  listType?: string
  url?: string
  src?: string
  children?: LexicalNode[]
}

export type LexicalRoot = {
  root: LexicalNode
}

export interface AdminInspirationEntry {
  id: number
  title: string | null
  content: string
  contentLexical?: string | null
  imageDataUrl: string | null
  statusSnapshot: string | null
  createdAt: string
}

export type InspirationDraft = {
  title: string
  content: string
  contentLexical: string
  imageDataUrl: string
  attachCurrentStatus: boolean
  attachStatusDeviceHash: string
  attachStatusActivityKey?: string
  attachStatusIncludeDeviceInfo?: boolean
}

export type OrphanAssetRow = {
  publicKey: string
  url: string
  createdAt: string | null
  ageMinutes: number | null
  eligibleForDelete: boolean
}
