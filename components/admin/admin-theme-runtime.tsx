'use client'

import { useEffect, useSyncExternalStore } from 'react'

import { useTheme } from '@/components/theme-provider'
import {
  ADMIN_THEME_APPEARANCE_EVENT,
  type AdminThemeAppearanceValue,
  buildAdminBackgroundVars,
  buildAdminThemeVars,
  clearAdminBackgroundVars,
  clearAdminThemeVars,
  readAdminBackgroundColor,
  readAdminThemeColor,
} from '@/lib/admin-theme-color'

function subscribe(onStoreChange: () => void) {
  if (typeof window === 'undefined') return () => undefined

  const handleCustomChange = () => onStoreChange()

  window.addEventListener(ADMIN_THEME_APPEARANCE_EVENT, handleCustomChange)
  return () => {
    window.removeEventListener(ADMIN_THEME_APPEARANCE_EVENT, handleCustomChange)
  }
}

export function useAdminThemeColor() {
  return useSyncExternalStore(subscribe, readAdminThemeColor, () => undefined)
}

export function useAdminBackgroundColor() {
  return useSyncExternalStore(subscribe, readAdminBackgroundColor, () => undefined)
}

function resolveAppearanceValue(
  preview: AdminThemeAppearanceValue,
  initial: string | null,
): string | null {
  return preview === undefined ? initial : preview
}

function getAdminThemeTarget(): HTMLElement {
  if (typeof document === 'undefined') return {} as HTMLElement
  return document.getElementById('admin-theme-root') ?? document.documentElement
}

export function AdminThemeRuntime({
  initialThemeColor = null,
  initialBackgroundColor = null,
}: {
  initialThemeColor?: string | null
  initialBackgroundColor?: string | null
}) {
  const previewColor = useAdminThemeColor()
  const previewBackgroundColor = useAdminBackgroundColor()
  const { resolvedTheme } = useTheme()
  const color = resolveAppearanceValue(previewColor, initialThemeColor)
  const backgroundColor = resolveAppearanceValue(previewBackgroundColor, initialBackgroundColor)

  useEffect(() => {
    const target = getAdminThemeTarget()
    clearAdminBackgroundVars(target)
    clearAdminThemeVars(target)

    if (backgroundColor) {
      const backgroundVars = buildAdminBackgroundVars(backgroundColor)
      for (const [key, value] of Object.entries(backgroundVars)) {
        target.style.setProperty(key, value)
      }
    }

    if (color) {
      const vars = buildAdminThemeVars(color, resolvedTheme ?? 'light')
      for (const [key, value] of Object.entries(vars)) {
        target.style.setProperty(key, value)
      }
    }

    return () => {
      clearAdminBackgroundVars(target)
      clearAdminThemeVars(target)
    }
  }, [backgroundColor, color, resolvedTheme])

  return null
}
