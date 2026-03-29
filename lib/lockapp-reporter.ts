/**
 * LockApp reporter: when the system is sleeping, reports may still POST with
 * process_name pointing at the reporter executable itself. Site config can
 * reject those to treat the device as offline.
 */

/** Basenames that identify the LockApp reporter foreground process (case-insensitive). */
const LOCKAPP_REPORTER_BASENAMES = new Set(['lockapp', 'lockapp.exe'])

/**
 * Returns true if processName is the LockApp reporter (basename match after trim).
 */
export function isLockAppReporterProcessName(processName: string): boolean {
  const t = processName.trim()
  if (!t) return false
  const base = t.replace(/^.*[/\\]/, '').toLowerCase()
  return LOCKAPP_REPORTER_BASENAMES.has(base)
}
