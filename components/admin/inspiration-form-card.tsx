'use client'

import { ImagePlus, Loader2, X } from 'lucide-react'
import type { Transition,Variants } from 'motion/react'
import { AnimatePresence, motion } from 'motion/react'
import Image from 'next/image'
import { useT } from 'next-i18next/client'
import type { RefObject } from 'react'

import { FileSelectTrigger } from '@/components/admin/file-select-trigger'
import { INSPIRATION_MAX_OUTPUT_EDGE } from '@/components/admin/inspiration-manager-constants'
import { LexicalEditor } from '@/components/admin/lexical-editor'
import { MarkdownContent } from '@/components/admin/markdown-content'
import { LexicalContent } from '@/components/lexical-content'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  inspirationLooksLikeMarkdown,
} from '@/lib/inspiration-preview'
import type {
  AdminDeviceSummary,
} from '@/types'

interface InspirationFormCardProps {
  formCardRef: RefObject<HTMLDivElement | null>
  bodyImageInputRef: RefObject<HTMLInputElement | null>
  // Form state
  title: string
  setTitle: (v: string) => void
  content: string
  setContent: (v: string) => void
  contentLexical: string
  setContentLexical: (v: string | ((prev: string) => string)) => void
  imageDataUrl: string
  setImageDataUrl: (v: string) => void
  attachCurrentStatus: boolean
  setAttachCurrentStatus: (v: boolean) => void
  attachStatusDeviceHash: string
  setAttachStatusDeviceHash: (v: string | ((prev: string) => string)) => void
  attachStatusActivityKey: string
  setAttachStatusActivityKey: (v: string | ((prev: string) => string)) => void
  attachStatusIncludeDeviceInfo: boolean
  setAttachStatusIncludeDeviceInfo: (v: boolean) => void
  statusSnapshotDraft: string
  setStatusSnapshotDraft: (v: string) => void
  editingEntryId: number | null
  bodyImageBusy: boolean
  submitting: boolean
  // Computed values
  computedSnapshotText: string
  snapshotCandidates: Array<{ key: string; group: 'active' | 'recent'; item: { id?: number | string; statusText?: string | null; processName?: string | null; processTitle?: string | null; device?: string | null; metadata?: unknown } }>
  // Device/activity data
  inspirationDevices: AdminDeviceSummary[]
  publicActivityLoading: boolean
  publicActivityError: string
  // Animation
  sectionVariants: Variants
  compactSectionVariants: Variants
  sectionTransition: Transition
  // Callbacks
  onSubmit: (e: React.FormEvent) => void
  onReset: () => void
  openCropForFile: (file: File | undefined, target: 'cover' | 'body') => void
}

export function InspirationFormCard({
  formCardRef,
  bodyImageInputRef,
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
  bodyImageBusy,
  submitting,
  computedSnapshotText,
  snapshotCandidates,
  inspirationDevices,
  publicActivityLoading,
  publicActivityError,
  sectionVariants,
  compactSectionVariants,
  sectionTransition,
  onSubmit,
  onReset,
  openCropForFile,
}: InspirationFormCardProps) {
  const { t } = useT('admin')

  return (
    <Card ref={formCardRef}>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          {editingEntryId ? (
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-foreground">
              {t('inspirationManager.editingNotice', { id: editingEntryId })}
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="insp-title">{t('inspirationManager.form.titleOptional')}</Label>
              <Input
                id="insp-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('inspirationManager.form.titlePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="insp-file">{t('inspirationManager.form.imageOptional')}</Label>
              <FileSelectTrigger
                id="insp-file"
                accept="image/*"
                buttonLabel={t('common.selectFile')}
                emptyLabel={t('common.noFileSelected')}
                onSelect={(file) => openCropForFile(file, 'cover')}
              />
              <p className="text-xs text-muted-foreground">
                {t('inspirationManager.form.imageHint', { value: INSPIRATION_MAX_OUTPUT_EDGE })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm font-normal cursor-pointer">
              <Checkbox
                checked={attachCurrentStatus}
                onCheckedChange={(v) => {
                  const on = v === true
                  setAttachCurrentStatus(on)
                  if (!on) {
                    setAttachStatusDeviceHash('')
                    setAttachStatusActivityKey('')
                    setAttachStatusIncludeDeviceInfo(false)
                  }
                }}
              />
              <span>{t('inspirationManager.form.attachCurrentStatus')}</span>
            </label>
          </div>
          <AnimatePresence initial={false}>
            {attachCurrentStatus ? (
              <motion.div
                className="space-y-2 rounded-md border border-border/60 bg-muted/10 p-3"
                variants={sectionVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={sectionTransition}
                layout
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    {t('inspirationManager.snapshot.optionalDevice')}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setAttachStatusDeviceHash('')}
                    >
                      {t('inspirationManager.snapshot.clear')}
                    </Button>
                  </div>
                </div>
                <div className="max-h-36 space-y-1 overflow-y-auto pr-1">
                  {inspirationDevices.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {t('inspirationManager.snapshot.noDevices')}
                    </p>
                  ) : (
                    inspirationDevices.map((d) => (
                      <label
                        key={d.id}
                        className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-xs transition-colors hover:bg-muted/30"
                      >
                        <Checkbox
                          checked={attachStatusDeviceHash === d.generatedHashKey}
                          onCheckedChange={(v) => {
                            const checked = v === true
                            setAttachStatusDeviceHash((prev) =>
                              checked ? d.generatedHashKey : prev === d.generatedHashKey ? '' : prev,
                            )
                            setAttachStatusActivityKey('')
                          }}
                        />
                        <span className="min-w-0 flex-1 truncate">{d.displayName}</span>
                        {d.status !== 'active' ? (
                          <span className="text-amber-600">({d.status})</span>
                        ) : null}
                      </label>
                    ))
                  )}
                </div>

                <AnimatePresence initial={false}>
                  {attachStatusDeviceHash ? (
                    <motion.div
                      className="mt-2 space-y-2 border-t border-border/50 pt-2"
                      variants={compactSectionVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      transition={sectionTransition}
                      layout
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground">
                          {t('inspirationManager.snapshot.selectActivity')}
                        </p>
                        <label className="flex items-center gap-2 text-xs font-normal cursor-pointer">
                          <Checkbox
                            checked={attachStatusIncludeDeviceInfo}
                            onCheckedChange={(v) => setAttachStatusIncludeDeviceInfo(v === true)}
                          />
                          <span>{t('inspirationManager.snapshot.includeDeviceInfo')}</span>
                        </label>
                      </div>

                      {publicActivityLoading ? (
                        <p className="text-xs text-muted-foreground">
                          {t('inspirationManager.snapshot.loadingActivities')}
                        </p>
                      ) : publicActivityError ? (
                        <p className="text-xs text-destructive">{publicActivityError}</p>
                      ) : snapshotCandidates.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          {t('inspirationManager.snapshot.noActivityCandidates')}
                        </p>
                      ) : (
                        <div className="max-h-44 space-y-1 overflow-y-auto pr-1">
                          {snapshotCandidates.map((c) => {
                            const label = (() => {
                              const st = String(c.item.statusText ?? '').trim()
                              if (st) return st
                              const pn = String(c.item.processName ?? '').trim()
                              const pt = c.item.processTitle != null ? String(c.item.processTitle).trim() : ''
                              if (pt && pn) return `${pt} | ${pn}`
                              return pn || pt || t('inspirationManager.common.untitled')
                            })()
                            return (
                              <label
                                key={c.key}
                                className="flex cursor-pointer items-start gap-2 rounded-md px-1.5 py-1 text-xs transition-colors hover:bg-muted/30"
                              >
                                <Checkbox
                                  checked={attachStatusActivityKey === c.key}
                                  onCheckedChange={(v) => {
                                    const checked = v === true
                                    setAttachStatusActivityKey((prev) => (checked ? c.key : prev === c.key ? '' : prev))
                                  }}
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="min-w-0 truncate text-foreground/90">
                                    {c.group === 'active'
                                      ? t('inspirationManager.snapshot.activePrefix')
                                      : t('inspirationManager.snapshot.recentPrefix')}
                                    {label}
                                  </div>
                                </div>
                              </label>
                            )
                          })}
                        </div>
                      )}

                      <div className="text-[11px] text-muted-foreground">
                        {t('inspirationManager.snapshot.selectionHint')}
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                <AnimatePresence initial={false}>
                  {computedSnapshotText ? (
                    <motion.div
                      className="mt-2 rounded-md border border-border/40 bg-muted/20 px-3 py-2"
                      variants={compactSectionVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      transition={sectionTransition}
                      layout
                    >
                      <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {t('inspirationManager.snapshot.preview')}
                      </p>
                      <p className="text-xs text-foreground/80 break-words">{computedSnapshotText}</p>
                    </motion.div>
                  ) : attachCurrentStatus && attachStatusDeviceHash && !publicActivityLoading && snapshotCandidates.length === 0 ? (
                    <motion.div
                      className="mt-2 rounded-md border border-border/40 bg-muted/10 px-3 py-2"
                      variants={compactSectionVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      transition={sectionTransition}
                      layout
                    >
                      <p className="text-[11px] text-muted-foreground">
                        {t('inspirationManager.snapshot.noActivityDataAfterSubmit')}
                      </p>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {!attachCurrentStatus && statusSnapshotDraft.trim() ? (
              <motion.div
                className="rounded-md border border-border/60 bg-muted/10 p-3"
                variants={compactSectionVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={sectionTransition}
                layout
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    {t('inspirationManager.snapshot.retainedSnapshot')}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setStatusSnapshotDraft('')}
                  >
                    <X className="h-3.5 w-3.5" />
                    {t('inspirationManager.snapshot.removeSnapshot')}
                  </Button>
                </div>
                <p className="text-xs break-words whitespace-pre-wrap text-foreground/80">
                  {statusSnapshotDraft}
                </p>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div className="space-y-2">
            <Label htmlFor="insp-content">{t('inspirationManager.form.contentRequired')}</Label>
            <Tabs defaultValue="edit" className="w-full">
              <TabsList className="mb-2">
                <TabsTrigger value="edit">{t('inspirationManager.tabs.edit')}</TabsTrigger>
                <TabsTrigger value="preview">{t('inspirationManager.tabs.preview')}</TabsTrigger>
              </TabsList>
              <TabsContent value="edit" className="mt-0 space-y-2">
                <input
                  ref={bodyImageInputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    openCropForFile(e.target.files?.[0], 'body')
                    e.target.value = ''
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={bodyImageBusy || submitting}
                  onClick={() => bodyImageInputRef.current?.click()}
                >
                  {bodyImageBusy ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <ImagePlus className="h-4 w-4 mr-1" />
                  )}
                  {t('inspirationManager.form.insertBodyImage')}
                </Button>
                <LexicalEditor
                  value={contentLexical}
                  onChange={(next) => setContentLexical(next)}
                  onPlainTextChange={(plain) => setContent(plain)}
                  placeholder={t('inspirationManager.form.contentPlaceholder')}
                />
              </TabsContent>
              <TabsContent value="preview" className="mt-0">
                <div className="rounded-md border border-border bg-muted/20 p-3 min-h-[220px] max-h-[360px] overflow-y-auto">
                  {content.trim() ? (
                    inspirationLooksLikeMarkdown(content) ? (
                      <MarkdownContent
                        markdown={content}
                        className="text-sm text-muted-foreground"
                        imageClassName="max-h-72 w-auto rounded-md border border-border my-2"
                      />
                    ) : (
                      <LexicalContent content={contentLexical} className="text-sm text-muted-foreground" />
                    )
                  ) : (
                    <p className="text-sm text-muted-foreground">{t('inspirationManager.common.noContent')}</p>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <AnimatePresence initial={false}>
            {imageDataUrl.trim() ? (
              <motion.div
                className="rounded-lg border bg-muted/30 p-3"
                variants={sectionVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={sectionTransition}
                layout
              >
                <p className="text-xs text-muted-foreground mb-2">{t('inspirationManager.form.imagePreview')}</p>
                <Image
                  src={imageDataUrl.trim()}
                  alt={t('inspirationManager.form.imagePreviewAlt')}
                  width={800}
                  height={600}
                  loading="eager"
                  className="max-h-56 w-auto rounded-md border bg-background"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => setImageDataUrl('')}
                >
                  {t('inspirationManager.form.removeImage')}
                </Button>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div className="flex items-center gap-3 flex-wrap">
            <Button type="submit" disabled={submitting || !content.trim()}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {editingEntryId
                    ? t('inspirationManager.form.saving')
                    : t('inspirationManager.form.submitting')}
                </>
              ) : (
                editingEntryId
                  ? t('inspirationManager.form.saveAndPublish')
                  : t('inspirationManager.form.submitInspiration')
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={onReset}
            >
              {editingEntryId
                ? t('inspirationManager.form.cancelEdit')
                : t('inspirationManager.form.clear')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
