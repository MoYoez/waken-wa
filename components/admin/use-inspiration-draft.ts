import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  INSPIRATION_DRAFT_STORAGE_KEY,
  INSPIRATION_DRAFT_STORAGE_KEY_V1,
} from '@/components/admin/inspiration-manager-constants'
import { createLexicalTextContent } from '@/components/admin/lexical-editor'
import { lexicalTextContent } from '@/lib/inspiration-lexical'
import type {
  ActivityFeedData,
  ActivityFeedItem,
  AdminDeviceSummary,
  AdminInspirationEntry,
  InspirationDraft,
} from '@/types'

interface UseInspirationDraftParams {
  inspirationDevices: AdminDeviceSummary[]
  publicActivityFeed: ActivityFeedData | null
  attachCurrentStatus: boolean
  setAttachCurrentStatus: (v: boolean) => void
  attachStatusDeviceHash: string
  setAttachStatusDeviceHash: (v: string | ((prev: string) => string)) => void
}

export function useInspirationDraft({
  inspirationDevices,
  publicActivityFeed,
  attachCurrentStatus,
  setAttachCurrentStatus,
  attachStatusDeviceHash,
  setAttachStatusDeviceHash,
}: UseInspirationDraftParams) {
  const formCardRef = useRef<HTMLDivElement>(null)
  const bodyImageInputRef = useRef<HTMLInputElement>(null)

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [contentLexical, setContentLexical] = useState(() => createLexicalTextContent(''))
  const [imageDataUrl, setImageDataUrl] = useState<string>('')
  const [attachStatusActivityKey, setAttachStatusActivityKey] = useState('')
  const [attachStatusIncludeDeviceInfo, setAttachStatusIncludeDeviceInfo] = useState(false)
  const [statusSnapshotDraft, setStatusSnapshotDraft] = useState('')
  const [editingEntryId, setEditingEntryId] = useState<number | null>(null)
  const [draftReady, setDraftReady] = useState(false)
  const [bodyImageBusy, setBodyImageBusy] = useState(false)

  // Draft restore effect (localStorage v1/v2 migration)
  useEffect(() => {
    try {
      const rawV2 = localStorage.getItem(INSPIRATION_DRAFT_STORAGE_KEY)
      const rawV1 = rawV2 ? null : localStorage.getItem(INSPIRATION_DRAFT_STORAGE_KEY_V1)
      const raw = rawV2 ?? rawV1
      if (!raw) return
      const draft = JSON.parse(raw) as Partial<InspirationDraft> & { attachStatusDeviceHashes?: unknown }
      const nextTitle = typeof draft.title === 'string' ? draft.title : ''
      const nextImage = typeof draft.imageDataUrl === 'string' ? draft.imageDataUrl : ''
      const nextAttach = draft.attachCurrentStatus === true
      const nextDeviceHashRaw =
        typeof draft.attachStatusDeviceHash === 'string'
          ? draft.attachStatusDeviceHash
          : Array.isArray(draft.attachStatusDeviceHashes)
            ? String(draft.attachStatusDeviceHashes.find((v) => typeof v === 'string') ?? '')
            : ''
      const nextDeviceHash = nextDeviceHashRaw.trim()
      const nextContentLexical =
        typeof draft.contentLexical === 'string' && draft.contentLexical.trim()
          ? draft.contentLexical
          : createLexicalTextContent(typeof draft.content === 'string' ? draft.content : '')
      const nextContent =
        typeof draft.content === 'string' ? draft.content : lexicalTextContent(nextContentLexical)

      setTitle(nextTitle)
      setImageDataUrl(nextImage)
      setAttachCurrentStatus(nextAttach)
      setAttachStatusDeviceHash(nextAttach ? nextDeviceHash : '')
      setAttachStatusActivityKey(nextAttach && typeof draft.attachStatusActivityKey === 'string' ? draft.attachStatusActivityKey : '')
      setAttachStatusIncludeDeviceInfo(nextAttach && draft.attachStatusIncludeDeviceInfo === true)
      setStatusSnapshotDraft('')
      setContentLexical(nextContentLexical)
      setContent(nextContent)

      if (rawV1) {
        const payload: InspirationDraft = {
          title: nextTitle,
          content: nextContent,
          contentLexical: nextContentLexical,
          imageDataUrl: nextImage,
          attachCurrentStatus: nextAttach,
          attachStatusDeviceHash: nextAttach ? nextDeviceHash : '',
        }
        localStorage.setItem(INSPIRATION_DRAFT_STORAGE_KEY, JSON.stringify(payload))
      }
    } catch {
      // Ignore broken local draft payload.
    } finally {
      setDraftReady(true)
    }
  }, [setAttachCurrentStatus, setAttachStatusDeviceHash])

  // Draft persist effect (auto-save to localStorage)
  useEffect(() => {
    if (!draftReady) return

    const lexicalPlain = lexicalTextContent(contentLexical).trim()
    const hasDraft =
      title.trim().length > 0 ||
      content.trim().length > 0 ||
      lexicalPlain.length > 0 ||
      imageDataUrl.trim().length > 0 ||
      attachCurrentStatus ||
      attachStatusDeviceHash.trim().length > 0 ||
      attachStatusActivityKey.trim().length > 0 ||
      attachStatusIncludeDeviceInfo

    if (!hasDraft) {
      localStorage.removeItem(INSPIRATION_DRAFT_STORAGE_KEY)
      return
    }

    const payload: InspirationDraft = {
      title,
      content,
      contentLexical,
      imageDataUrl,
      attachCurrentStatus,
      attachStatusDeviceHash,
      attachStatusActivityKey: attachStatusActivityKey.trim() || undefined,
      attachStatusIncludeDeviceInfo: attachStatusIncludeDeviceInfo || undefined,
    }
    localStorage.setItem(INSPIRATION_DRAFT_STORAGE_KEY, JSON.stringify(payload))
  }, [
    attachCurrentStatus,
    attachStatusActivityKey,
    attachStatusDeviceHash,
    attachStatusIncludeDeviceInfo,
    content,
    contentLexical,
    draftReady,
    imageDataUrl,
    title,
  ])

  // Snapshot-related useMemo
  const selectedSnapshotDevice = useMemo(() => {
    if (!attachStatusDeviceHash) return null
    return inspirationDevices.find((d) => d.generatedHashKey === attachStatusDeviceHash) ?? null
  }, [attachStatusDeviceHash, inspirationDevices])

  const selectedSnapshotDeviceName = selectedSnapshotDevice?.displayName ?? ''

  const snapshotCandidates = useMemo(() => {
    if (!publicActivityFeed || !selectedSnapshotDeviceName) return []
    const deviceName = selectedSnapshotDeviceName
    const active = (publicActivityFeed.activeStatuses ?? []).filter((x) => x.device === deviceName)
    const recent = (publicActivityFeed.recentActivities ?? []).filter((x) => x.device === deviceName)
    const out: Array<{ key: string; group: 'active' | 'recent'; item: ActivityFeedItem }> = []
    for (const it of active) out.push({ key: `active:${String(it.id)}`, group: 'active', item: it })
    for (const it of recent) out.push({ key: `recent:${String(it.id)}`, group: 'recent', item: it })
    return out
  }, [publicActivityFeed, selectedSnapshotDeviceName])

  const selectedSnapshotCandidate = useMemo(() => {
    if (!attachStatusActivityKey) return null
    return snapshotCandidates.find((c) => c.key === attachStatusActivityKey) ?? null
  }, [attachStatusActivityKey, snapshotCandidates])

  // Pre-compute snapshot text on the client side from what's already loaded in the UI.
  // This text is sent directly to the server so it doesn't need to re-query the activity feed.
  const computedSnapshotText = useMemo(() => {
    if (!attachCurrentStatus || !attachStatusDeviceHash) return ''

    // Require explicit selection (UX requirement).
    const chosen = selectedSnapshotCandidate?.item ?? null
    if (!chosen) return ''

    const st = String(chosen.statusText ?? '').trim()
    const pn = String(chosen.processName ?? '').trim()
    const pt = chosen.processTitle != null ? String(chosen.processTitle).trim() : ''
    const base = st || (pt && pn ? `${pt} | ${pn}` : pn || pt || '')
    if (!base) return ''

    // Only append device info when the user explicitly enables it.
    if (!attachStatusIncludeDeviceInfo) return base

    const deviceName = String(selectedSnapshotDeviceName || chosen.device || '').trim()
    if (!deviceName) return base

    const battRaw =
      chosen.metadata && typeof chosen.metadata === 'object'
        ? (chosen.metadata as Record<string, unknown>).deviceBatteryPercent
        : null
    const batt = typeof battRaw === 'number' && Number.isFinite(battRaw) ? Math.round(battRaw) : null
    const suffix =
      batt !== null
        ? `(${deviceName} · ${batt}%)`
        : `(${deviceName})`

    return `${base} ${suffix}`.trim()
  }, [
    attachCurrentStatus,
    attachStatusDeviceHash,
    selectedSnapshotCandidate,
    selectedSnapshotDeviceName,
    attachStatusIncludeDeviceInfo,
  ])

  // Auto-pick a default candidate once data is loaded (still satisfies "must pick one"). Prefer active.
  useEffect(() => {
    if (!attachCurrentStatus) return
    if (!attachStatusDeviceHash) return
    if (attachStatusActivityKey) return
    if (snapshotCandidates.length === 0) return
    const preferred = snapshotCandidates.find((c) => c.group === 'active') ?? snapshotCandidates[0]
    setAttachStatusActivityKey(preferred.key)
  }, [attachCurrentStatus, attachStatusDeviceHash, attachStatusActivityKey, snapshotCandidates])

  const resetEditor = useCallback(() => {
    setTitle('')
    setContent('')
    setContentLexical(createLexicalTextContent(''))
    setImageDataUrl('')
    setAttachCurrentStatus(false)
    setAttachStatusDeviceHash('')
    setAttachStatusActivityKey('')
    setAttachStatusIncludeDeviceInfo(false)
    setStatusSnapshotDraft('')
    setEditingEntryId(null)
    localStorage.removeItem(INSPIRATION_DRAFT_STORAGE_KEY)
  }, [setAttachCurrentStatus, setAttachStatusDeviceHash])

  const handleEdit = useCallback((entry: AdminInspirationEntry) => {
    setEditingEntryId(entry.id)
    setTitle(entry.title ?? '')
    setContent(entry.content)
    setContentLexical(
      typeof entry.contentLexical === 'string' && entry.contentLexical.trim()
        ? entry.contentLexical
        : createLexicalTextContent(entry.content),
    )
    setImageDataUrl(entry.imageDataUrl ?? '')
    setAttachCurrentStatus(false)
    setAttachStatusDeviceHash('')
    setAttachStatusActivityKey('')
    setAttachStatusIncludeDeviceInfo(false)
    setStatusSnapshotDraft(entry.statusSnapshot ?? '')

    requestAnimationFrame(() => {
      formCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [setAttachCurrentStatus, setAttachStatusDeviceHash])

  return {
    // Refs
    formCardRef,
    bodyImageInputRef,
    // Form state
    title,
    setTitle,
    content,
    setContent,
    contentLexical,
    setContentLexical,
    imageDataUrl,
    setImageDataUrl,
    attachCurrentStatus,
    setAttachCurrentStatus,
    attachStatusDeviceHash,
    setAttachStatusDeviceHash,
    attachStatusActivityKey,
    setAttachStatusActivityKey,
    attachStatusIncludeDeviceInfo,
    setAttachStatusIncludeDeviceInfo,
    statusSnapshotDraft,
    setStatusSnapshotDraft,
    editingEntryId,
    setEditingEntryId,
    draftReady,
    bodyImageBusy,
    setBodyImageBusy,
    // Computed values
    selectedSnapshotDevice,
    selectedSnapshotDeviceName,
    snapshotCandidates,
    selectedSnapshotCandidate,
    computedSnapshotText,
    // Callbacks
    resetEditor,
    handleEdit,
  }
}
