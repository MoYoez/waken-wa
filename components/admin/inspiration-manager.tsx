'use client'

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useReducedMotion } from 'motion/react'
import { useT } from 'next-i18next/client'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import {
  getAdminPanelTransition,
  getAdminSectionVariants,
} from '@/components/admin/admin-motion'
import {
  fetchAdminDeviceSummaries,
  fetchAdminInspirationEntries,
  fetchPublicActivityFeed,
} from '@/components/admin/admin-query-fetchers'
import { adminQueryKeys } from '@/components/admin/admin-query-keys'
import {
  createInspirationEntry,
  deleteInspirationEntry,
  patchInspirationEntry,
  uploadInspirationAsset,
} from '@/components/admin/admin-query-mutations'
import { ImageCropDialog } from '@/components/admin/image-crop-dialog'
import { InspirationEntryList } from '@/components/admin/inspiration-entry-list'
import { InspirationFormCard } from '@/components/admin/inspiration-form-card'
import {
  INSPIRATION_DRAFT_STORAGE_KEY,
  INSPIRATION_LIST_PAGE_SIZE,
  INSPIRATION_MAX_OUTPUT_EDGE,
} from '@/components/admin/inspiration-manager-constants'
import { InspirationPreviewDialog } from '@/components/admin/inspiration-preview-dialog'
import { createLexicalTextContent } from '@/components/admin/lexical-editor'
import { useInspirationDraft } from '@/components/admin/use-inspiration-draft'
import { useSiteTimeFormat } from '@/components/site-timezone-provider'
import { appendParagraphTextToLexical, lexicalTextContent } from '@/lib/inspiration-lexical'
import type { AdminInspirationEntry } from '@/types'

export function InspirationManager() {
  const { t } = useT('admin')
  const queryClient = useQueryClient()
  const prefersReducedMotion = Boolean(useReducedMotion())
  const { formatPattern } = useSiteTimeFormat()
  const [page, setPage] = useState(0)
  const [q, setQ] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [previewEntry, setPreviewEntry] = useState<AdminInspirationEntry | null>(null)

  const [cropSourceUrl, setCropSourceUrl] = useState<string | null>(null)
  const [cropDialogOpen, setCropDialogOpen] = useState(false)
  const [cropTarget, setCropTarget] = useState<'cover' | 'body'>('cover')

  const entriesQuery = useQuery({
    queryKey: adminQueryKeys.inspiration.entries({ page, q }),
    queryFn: () => fetchAdminInspirationEntries({ page, q, pageSize: INSPIRATION_LIST_PAGE_SIZE }),
    placeholderData: keepPreviousData,
  })

  const inspirationDevicesQuery = useQuery({
    queryKey: adminQueryKeys.inspiration.devices({ limit: 200 }),
    queryFn: () => fetchAdminDeviceSummaries({ limit: 200 }),
  })

  const entries = useMemo(() => entriesQuery.data?.entries ?? [], [entriesQuery.data?.entries])
  const total = entriesQuery.data?.total ?? 0
  const loading = entriesQuery.isLoading
  const inspirationDevices = useMemo(
    () => inspirationDevicesQuery.data ?? [],
    [inspirationDevicesQuery.data],
  )

  // The draft hook needs publicActivityFeed data for snapshot memos, but the query's
  // `enabled` flag depends on draft state (attachCurrentStatus, attachStatusDeviceHash).
  // We lift a thin piece of state (attachCurrentStatus, attachStatusDeviceHash) out so
  // the query can reference it before the draft hook is called. The draft hook then
  // receives both the lifted state and the query result.
  const [attachCurrentStatus, setAttachCurrentStatus] = useState(false)
  const [attachStatusDeviceHash, setAttachStatusDeviceHash] = useState('')

  const publicActivityFeedQuery = useQuery({
    queryKey: adminQueryKeys.activity.publicFeed(),
    queryFn: fetchPublicActivityFeed,
    enabled: attachCurrentStatus && Boolean(attachStatusDeviceHash),
  })

  const publicActivityFeed = publicActivityFeedQuery.data ?? null

  const draft = useInspirationDraft({
    inspirationDevices,
    publicActivityFeed,
    attachCurrentStatus,
    setAttachCurrentStatus,
    attachStatusDeviceHash,
    setAttachStatusDeviceHash,
  })

  const publicActivityLoading = publicActivityFeedQuery.isLoading
  const publicActivityError = publicActivityFeedQuery.error
    ? publicActivityFeedQuery.error instanceof Error
      ? publicActivityFeedQuery.error.message
      : t('inspirationManager.publicActivityLoadFailed')
    : ''

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / INSPIRATION_LIST_PAGE_SIZE)),
    [total],
  )
  const sectionTransition = useMemo(
    () => getAdminPanelTransition(prefersReducedMotion),
    [prefersReducedMotion],
  )
  const sectionVariants = useMemo(
    () => getAdminSectionVariants(prefersReducedMotion),
    [prefersReducedMotion],
  )
  const compactSectionVariants = useMemo(
    () =>
      getAdminSectionVariants(prefersReducedMotion, {
        enterY: 10,
        exitY: 8,
        scale: 0.996,
      }),
    [prefersReducedMotion],
  )

  useEffect(() => {
    if (loading || total <= 0) return
    const maxPage = Math.max(0, Math.ceil(total / INSPIRATION_LIST_PAGE_SIZE) - 1)
    if (page > maxPage) setPage(maxPage)
  }, [loading, total, page])

  useEffect(() => {
    return () => {
      if (cropSourceUrl) URL.revokeObjectURL(cropSourceUrl)
    }
  }, [cropSourceUrl])

  const createEntryMutation = useMutation({
    mutationFn: async () => {
      await createInspirationEntry({
        title: draft.title.trim() || undefined,
        content: draft.content.trim(),
        contentLexical: draft.contentLexical,
        imageDataUrl: draft.imageDataUrl.trim() || undefined,
        attachCurrentStatus: draft.attachCurrentStatus,
        preComputedStatusSnapshot: draft.computedSnapshotText || undefined,
        attachStatusDeviceHash: draft.attachStatusDeviceHash.trim() || undefined,
        attachStatusActivityKey: draft.attachStatusActivityKey.trim() || undefined,
        attachStatusIncludeDeviceInfo: draft.attachStatusIncludeDeviceInfo || undefined,
      })
    },
    onSuccess: async () => {
      draft.setTitle('')
      draft.setContent('')
      draft.setContentLexical(createLexicalTextContent(''))
      draft.setImageDataUrl('')
      draft.setAttachCurrentStatus(false)
      draft.setAttachStatusDeviceHash('')
      draft.setAttachStatusActivityKey('')
      draft.setAttachStatusIncludeDeviceInfo(false)
      draft.setStatusSnapshotDraft('')
      draft.setEditingEntryId(null)
      localStorage.removeItem(INSPIRATION_DRAFT_STORAGE_KEY)
      setPage(0)
      toast.success(t('inspirationManager.toasts.submitted'))
      await queryClient.invalidateQueries({ queryKey: ['admin', 'inspiration', 'entries'] })
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t('common.networkErrorRetry'))
    },
  })

  const updateEntryMutation = useMutation({
    mutationFn: async () => {
      if (!draft.editingEntryId) {
        throw new Error(t('inspirationManager.missingEditingEntry'))
      }
      await patchInspirationEntry({
        id: draft.editingEntryId,
        title: draft.title.trim() || undefined,
        content: draft.content.trim(),
        contentLexical: draft.contentLexical,
        imageDataUrl: draft.imageDataUrl.trim() || undefined,
        attachCurrentStatus: draft.attachCurrentStatus,
        statusSnapshot: !draft.attachCurrentStatus ? draft.statusSnapshotDraft.trim() || null : undefined,
        preComputedStatusSnapshot: draft.attachCurrentStatus ? draft.computedSnapshotText || undefined : undefined,
        attachStatusDeviceHash: draft.attachStatusDeviceHash.trim() || undefined,
        attachStatusActivityKey: draft.attachStatusActivityKey.trim() || undefined,
        attachStatusIncludeDeviceInfo: draft.attachStatusIncludeDeviceInfo || undefined,
      })
    },
    onSuccess: async () => {
      draft.setTitle('')
      draft.setContent('')
      draft.setContentLexical(createLexicalTextContent(''))
      draft.setImageDataUrl('')
      draft.setAttachCurrentStatus(false)
      draft.setAttachStatusDeviceHash('')
      draft.setAttachStatusActivityKey('')
      draft.setAttachStatusIncludeDeviceInfo(false)
      draft.setStatusSnapshotDraft('')
      draft.setEditingEntryId(null)
      localStorage.removeItem(INSPIRATION_DRAFT_STORAGE_KEY)
      toast.success(t('inspirationManager.toasts.updated'))
      await queryClient.invalidateQueries({ queryKey: ['admin', 'inspiration', 'entries'] })
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t('common.networkErrorRetry'))
    },
  })

  const deleteEntryMutation = useMutation({
    mutationFn: async (id: number) => {
      await deleteInspirationEntry(id)
    },
    onSuccess: async () => {
      toast.success(t('inspirationManager.toasts.deleted'))
      await queryClient.invalidateQueries({ queryKey: ['admin', 'inspiration', 'entries'] })
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t('inspirationManager.toasts.deleteFailed'))
    },
  })

  const uploadAssetMutation = useMutation({
    mutationFn: uploadInspirationAsset,
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t('mutation.uploadBodyImageFailed'))
    },
  })

  const openCropForFile = (file: File | undefined, target: 'cover' | 'body') => {
    if (!file) return
    setCropTarget(target)
    if (cropSourceUrl) URL.revokeObjectURL(cropSourceUrl)
    const objectUrl = URL.createObjectURL(file)
    setCropSourceUrl(objectUrl)
    setCropDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      if (draft.editingEntryId) {
        await updateEntryMutation.mutateAsync()
      } else {
        await createEntryMutation.mutateAsync()
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    await deleteEntryMutation.mutateAsync(id)
  }

  return (
    <div className="space-y-4">
      <InspirationFormCard
        formCardRef={draft.formCardRef}
        bodyImageInputRef={draft.bodyImageInputRef}
        title={draft.title}
        setTitle={draft.setTitle}
        content={draft.content}
        setContent={draft.setContent}
        contentLexical={draft.contentLexical}
        setContentLexical={draft.setContentLexical}
        imageDataUrl={draft.imageDataUrl}
        setImageDataUrl={draft.setImageDataUrl}
        attachCurrentStatus={draft.attachCurrentStatus}
        setAttachCurrentStatus={draft.setAttachCurrentStatus}
        attachStatusDeviceHash={draft.attachStatusDeviceHash}
        setAttachStatusDeviceHash={draft.setAttachStatusDeviceHash}
        attachStatusActivityKey={draft.attachStatusActivityKey}
        setAttachStatusActivityKey={draft.setAttachStatusActivityKey}
        attachStatusIncludeDeviceInfo={draft.attachStatusIncludeDeviceInfo}
        setAttachStatusIncludeDeviceInfo={draft.setAttachStatusIncludeDeviceInfo}
        statusSnapshotDraft={draft.statusSnapshotDraft}
        setStatusSnapshotDraft={draft.setStatusSnapshotDraft}
        editingEntryId={draft.editingEntryId}
        bodyImageBusy={draft.bodyImageBusy}
        submitting={submitting}
        computedSnapshotText={draft.computedSnapshotText}
        snapshotCandidates={draft.snapshotCandidates}
        inspirationDevices={inspirationDevices}
        publicActivityLoading={publicActivityLoading}
        publicActivityError={publicActivityError}
        sectionVariants={sectionVariants}
        compactSectionVariants={compactSectionVariants}
        sectionTransition={sectionTransition}
        onSubmit={handleSubmit}
        onReset={draft.resetEditor}
        openCropForFile={openCropForFile}
      />

      <ImageCropDialog
        open={cropDialogOpen}
        onOpenChange={(open) => {
          setCropDialogOpen(open)
          if (!open) {
            setCropSourceUrl((prev) => {
              if (prev) URL.revokeObjectURL(prev)
              return null
            })
          }
        }}
        sourceUrl={cropSourceUrl}
        aspectMode="free"
        outputSize={INSPIRATION_MAX_OUTPUT_EDGE}
        title={
          cropTarget === 'body'
            ? t('inspirationManager.crop.bodyTitle')
            : t('inspirationManager.crop.coverTitle')
        }
        description={t('inspirationManager.crop.description')}
        onComplete={(dataUrl) => {
          if (cropTarget === 'cover') {
            draft.setImageDataUrl(dataUrl)
            return
          }
          void (async () => {
            draft.setBodyImageBusy(true)
            try {
              const url = await uploadAssetMutation.mutateAsync(dataUrl)
              draft.setContentLexical((prev) => {
                const next = appendParagraphTextToLexical(prev, `![](${url})`)
                draft.setContent(lexicalTextContent(next))
                return next
              })
              toast.success(t('inspirationManager.toasts.bodyImageInserted'))
            } finally {
              draft.setBodyImageBusy(false)
            }
          })()
        }}
      />

      <InspirationEntryList
        entries={entries}
        total={total}
        loading={loading}
        page={page}
        totalPages={totalPages}
        q={q}
        onQChange={setQ}
        onPageChange={setPage}
        onEdit={draft.handleEdit}
        onDelete={handleDelete}
        onPreview={setPreviewEntry}
        formatPattern={formatPattern}
        compactSectionVariants={compactSectionVariants}
        sectionTransition={sectionTransition}
      />

      <InspirationPreviewDialog
        entry={previewEntry}
        onClose={() => setPreviewEntry(null)}
        formatPattern={formatPattern}
      />
    </div>
  )
}
