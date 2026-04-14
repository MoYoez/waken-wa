'use client'

import { useEffect, useSyncExternalStore } from 'react'

import { useTheme } from '@/components/theme-provider'
import {
  ADMIN_BACKGROUND_COLOR_STORAGE_KEY,
  ADMIN_THEME_APPEARANCE_EVENT,
  ADMIN_THEME_COLOR_STORAGE_KEY,
  buildAdminBackgroundVars,
  buildAdminThemeVars,
  clearAdminBackgroundVars,
  clearAdminThemeVars,
  readAdminBackgroundColor,
  readAdminThemeColor,
} from '@/lib/admin-theme-color'

function subscribe(onStoreChange: () => void) {
  if (typeof window === 'undefined') return () => undefined

  const handleStorage = (event: StorageEvent) => {
    if (
      event.key &&
      event.key !== ADMIN_THEME_COLOR_STORAGE_KEY &&
      event.key !== ADMIN_BACKGROUND_COLOR_STORAGE_KEY
    ) {
      return
    }
    onStoreChange()
  }
  const handleCustomChange = () => onStoreChange()

  window.addEventListener('storage', handleStorage)
  window.addEventListener(ADMIN_THEME_APPEARANCE_EVENT, handleCustomChange)
  return () => {
    window.removeEventListener('storage', handleStorage)
    window.removeEventListener(ADMIN_THEME_APPEARANCE_EVENT, handleCustomChange)
  }
}

export function useAdminThemeColor() {
  return useSyncExternalStore(subscribe, readAdminThemeColor, () => null)
}

export function useAdminBackgroundColor() {
  return useSyncExternalStore(subscribe, readAdminBackgroundColor, () => null)
}

export function AdminThemeRuntime() {
  const color = useAdminThemeColor()
  const backgroundColor = useAdminBackgroundColor()
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    const target = document.documentElement
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
