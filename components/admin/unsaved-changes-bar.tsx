'use client'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useT } from 'next-i18next/client'
import { useState } from 'react'
import { createPortal } from 'react-dom'

import {
  getAdminFloatingBarVariants,
  getAdminPanelTransition,
} from '@/components/admin/admin-motion'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type UnsavedChangesBarProps = {
  open: boolean
  saving?: boolean
  onSave: () => void | Promise<void>
  onRevert: () => void
  saveLabel?: string
  revertLabel?: string
  message?: string
  className?: string
  /** Alert when confirming revert (Chinese admin copy). */
  revertDialogTitle?: string
  revertDialogDescription?: string
  revertDialogConfirm?: string
}

/**
 * Fixed bottom bar for forms with explicit save; portals to document.body so
 * position:fixed is viewport-relative (not trapped by transformed ancestors).
 * Enter/exit use motion so portal presence is managed by AnimatePresence.
 * Stays below dialogs (z-50).
 */
export function UnsavedChangesBar({
  open,
  saving = false,
  onSave,
  onRevert,
  saveLabel,
  revertLabel,
  message,
  className,
  revertDialogTitle,
  revertDialogDescription,
  revertDialogConfirm,
}: UnsavedChangesBarProps) {
  const { t } = useT('admin')
  const [revertDialogOpen, setRevertDialogOpen] = useState(false)
  const prefersReducedMotion = Boolean(useReducedMotion())
  const resolvedSaveLabel = saveLabel ?? t('common.save')
  const resolvedRevertLabel = revertLabel ?? t('unsavedChanges.revert')
  const resolvedMessage = message ?? t('unsavedChanges.pending')
  const resolvedRevertDialogTitle =
    revertDialogTitle ?? t('unsavedChanges.revertDialogTitle')
  const resolvedRevertDialogDescription =
    revertDialogDescription ?? t('unsavedChanges.revertDialogDescription')
  const resolvedRevertDialogConfirm =
    revertDialogConfirm ?? t('unsavedChanges.revertDialogConfirm')

  if (typeof document === 'undefined') return null

  return createPortal(
    <>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="unsaved-changes-bar"
            className={cn(
              'fixed bottom-4 left-1/2 z-40 w-[min(100%-1.5rem,28rem)] -translate-x-1/2 px-1 pb-[env(safe-area-inset-bottom,0)]',
              className,
            )}
            role="status"
            aria-live="polite"
            aria-label={t('unsavedChanges.ariaLabel')}
            variants={getAdminFloatingBarVariants(prefersReducedMotion)}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={getAdminPanelTransition(prefersReducedMotion)}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/80 bg-card/95 px-3 py-2.5 shadow-lg backdrop-blur-md sm:px-4">
              <span className="text-xs text-muted-foreground sm:text-sm">{resolvedMessage}</span>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setRevertDialogOpen(true)}
                  disabled={saving}
                >
                  {resolvedRevertLabel}
                </Button>
                <Button type="button" size="sm" onClick={() => void onSave()} disabled={saving}>
                  {saving ? t('unsavedChanges.saving') : resolvedSaveLabel}
                </Button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AlertDialog open={revertDialogOpen} onOpenChange={setRevertDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{resolvedRevertDialogTitle}</AlertDialogTitle>
            <AlertDialogDescription>{resolvedRevertDialogDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              onClick={() => {
                onRevert()
              }}
            >
              {resolvedRevertDialogConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>,
    document.body,
  )
}
