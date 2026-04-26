'use client'

import type { BrowserMemoryInfo, BrowserStartupLogOptions } from '@/types/browser-startup'

const BROWSER_STARTUP_BANNER = String.raw`
__        __    _                  __        __
\ \      / /_ _| | _____ _ __      \ \      / /_
 \ \ /\ / / _' | |/ / _ \ '_ \ _____\ \ /\ / / _' |
  \ V  V / (_| |   <  __/ | | |_____\ V  V / (_| |
   \_/\_/ \__,_|_|\_\___|_| |_|      \_/\_/ \__,_|
`

const GITHUB_URL = 'https://github.com/MoYoez/waken-wa'

const CONSOLE_BANNER_STYLE = 'color:#0ea5e9;font-family:Consolas,Monaco,monospace;font-weight:700;'
const CONSOLE_BRAND_STYLE = 'color:#0ea5e9;font-weight:700;font-size:13px;'
const CONSOLE_LINK_LABEL_STYLE = 'color:#0284c7;font-weight:600;'
const CONSOLE_META_STYLE = 'color:#475569;font-weight:500;'
const CONSOLE_LOAD_LABEL_STYLE = 'color:#7c3aed;font-weight:600;'
const CONSOLE_MEMORY_LABEL_STYLE = 'color:#16a34a;font-weight:600;'

function formatDuration(ms: number) {
  if (!Number.isFinite(ms) || ms < 0) return 'n/a'
  if (ms < 1000) return `${Math.round(ms)} ms`
  if (ms < 10_000) return `${(ms / 1000).toFixed(2)} s`
  return `${(ms / 1000).toFixed(1)} s`
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return 'n/a'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  const precision = unitIndex === 0 ? 0 : value >= 100 ? 0 : value >= 10 ? 1 : 2
  return `${value.toFixed(precision)} ${units[unitIndex]}`
}

async function readBrowserMemory(): Promise<BrowserMemoryInfo | null> {
  if (typeof performance === 'undefined') return null

  if (typeof performance.measureUserAgentSpecificMemory === 'function') {
    try {
      const result = await performance.measureUserAgentSpecificMemory()
      if (result?.bytes && Number.isFinite(result.bytes)) {
        return {
          label: 'UA memory',
          usedBytes: result.bytes,
        }
      }
    } catch {
      // Ignore unsupported or blocked UA memory reads.
    }
  }

  const heap = performance.memory
  if (heap?.usedJSHeapSize && Number.isFinite(heap.usedJSHeapSize)) {
    return {
      label: 'JS heap',
      usedBytes: heap.usedJSHeapSize,
      totalBytes: heap.totalJSHeapSize,
    }
  }

  return null
}

function getNavigationLoadTimeMs() {
  if (typeof performance === 'undefined') return 0
  const navigationEntry = performance.getEntriesByType('navigation')[0]
  if (navigationEntry && Number.isFinite(navigationEntry.startTime)) {
    return performance.now() - navigationEntry.startTime
  }
  return performance.now()
}

function markStartupLogPrinted(key: string) {
  if (typeof window === 'undefined') return false
  const printedKeys = window.__wakenBrowserStartupLogKeys ?? new Set<string>()
  if (printedKeys.has(key)) return true
  printedKeys.add(key)
  window.__wakenBrowserStartupLogKeys = printedKeys
  return false
}

export async function logBrowserStartupBanner({
  appVersion,
  scope,
}: BrowserStartupLogOptions) {
  if (typeof window === 'undefined') return

  const key = `${scope}:${window.location.pathname}:${performance.timeOrigin}`
  if (markStartupLogPrinted(key)) return

  const memory = await readBrowserMemory()
  const loadTimeMs = getNavigationLoadTimeMs()
  const scopeLabel = scope === 'home' ? 'home' : 'inspiration'

  console.log(
    `%c${BROWSER_STARTUP_BANNER}`,
    CONSOLE_BANNER_STYLE,
  )
  console.log(
    `%cWaken-Wa v${appVersion}%c browser · ${scopeLabel}`,
    CONSOLE_BRAND_STYLE,
    CONSOLE_META_STYLE,
  )
  console.log(
    `%cGitHub%c ${GITHUB_URL}`,
    CONSOLE_LINK_LABEL_STYLE,
    CONSOLE_META_STYLE,
  )

  if (memory) {
    const memoryText = memory.totalBytes
      ? `${formatBytes(memory.usedBytes)} / ${formatBytes(memory.totalBytes)}`
      : formatBytes(memory.usedBytes)

    console.log(
      `%cLoad%c ${formatDuration(loadTimeMs)}  %cMemory%c ${memory.label}: ${memoryText}`,
      CONSOLE_LOAD_LABEL_STYLE,
      CONSOLE_META_STYLE,
      CONSOLE_MEMORY_LABEL_STYLE,
      CONSOLE_META_STYLE,
    )
    return
  }

  console.log(
    `%cLoad%c ${formatDuration(loadTimeMs)}  %cMemory%c unavailable`,
    CONSOLE_LOAD_LABEL_STYLE,
    CONSOLE_META_STYLE,
    CONSOLE_MEMORY_LABEL_STYLE,
    CONSOLE_META_STYLE,
  )
}
