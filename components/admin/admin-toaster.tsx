'use client'

import { useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'

import { Toaster } from '@/components/ui/sonner'

const emptySubscribe = () => () => {}

function useIsClient() {
  return useSyncExternalStore(emptySubscribe, () => true, () => false)
}

/**
 * Renders Sonner at document.body so toasts stay viewport-fixed (not affected by
 * scrollable admin layout). Uses bottom-center so feedback is visible when
 * acting near the bottom of long pages.
 */
export function AdminToaster() {
  const isClient = useIsClient()
  if (!isClient) return null

  return createPortal(
    <Toaster
      richColors
      closeButton
      position="bottom-center"
      offset="1rem"
      className="z-[100]"
    />,
    document.body,
  )
}
