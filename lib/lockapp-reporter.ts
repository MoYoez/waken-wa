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

/** Explicit screen state takes precedence over desktop process-name detection. */
export function getReportedScreenState(
  metadata: Record<string, unknown> | null | undefined,
): 'locked' | 'inactive' | 'active' | null {
  if (!metadata || (!('screen_locked' in metadata) && !('screen_interactive' in metadata))) {
    return null
  }
  if (typeof metadata.screen_locked !== 'boolean' || typeof metadata.screen_interactive !== 'boolean') {
    throw new Error('metadata.screen_locked and metadata.screen_interactive must both be booleans')
  }
  if (metadata.screen_locked) return 'locked'
  return metadata.screen_interactive ? 'active' : 'inactive'
}

export function isLockScreenReport(
  processName: string,
  metadata: Record<string, unknown> | null | undefined,
): boolean {
  const screenState = getReportedScreenState(metadata)
  return screenState === null
    ? isLockScreenReporterProcessName(processName)
    : screenState !== 'active'
}
