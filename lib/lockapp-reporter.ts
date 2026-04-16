/**
 * Lock-screen / sleep-like reporters: when the system is locked or sleeping,
 * some clients may still POST with the foreground process pointing at the
 * platform lock UI itself. Site config can reject those to treat the device as
 * offline.
 */

/** Basenames or bundle ids that identify lock-screen foreground processes. */
const LOCK_SCREEN_REPORTER_NAMES = new Set([
  'lockapp',
  'lockapp.exe',
  'loginwindow',
  'com.apple.loginwindow',
])

/**
 * Returns true if processName matches a known lock-screen / sleep-like process.
 */
export function isLockScreenReporterProcessName(processName: string): boolean {
  const t = processName.trim()
  if (!t) return false
  const base = t.replace(/^.*[/\\]/, '').toLowerCase()
  return LOCK_SCREEN_REPORTER_NAMES.has(base)
}

export const isLockAppReporterProcessName = isLockScreenReporterProcessName
