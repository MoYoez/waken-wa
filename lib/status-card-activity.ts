import { getMediaDisplay } from '@/lib/activity-media'
import { getReportedScreenState } from '@/lib/lockapp-reporter'
import type { ScheduleOccurrence } from '@/lib/schedule-courses'
import { getTrimmedText } from '@/lib/status-card-text'
import type { ActivityFeedItem } from '@/types/activity'

export function getStatusLine(activity: ActivityFeedItem | null): string {
  if (!activity) return 'No active status'
  const statusText = getTrimmedText(activity.statusText)
  if (statusText) return statusText
  return getProcessLine(activity) || 'Active now'
}

function getProcessLine(activity: ActivityFeedItem | null): string {
  if (!activity) return ''
  const processTitle = getTrimmedText(activity.processTitle)
  const processName = getTrimmedText(activity.processName)
  if (processTitle && processName && processTitle !== processName) {
    return `${processTitle} | ${processName}`
  }
  return processTitle || processName
}

export function getMediaLine(activity: ActivityFeedItem | null): string {
  if (!activity) return ''
  const media = getMediaDisplay(activity.metadata)
  if (!media) return ''
  return media.singer ? `${media.title} · ${media.singer}` : media.title
}

export function getSteamGameName(activity: ActivityFeedItem | null): string {
  const name = getTrimmedText(activity?.steamNowPlaying?.name)
  return name || ''
}

function formatTimeHm(value: Date): string {
  return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`
}

export function getInClassStatusLine(occurrence?: ScheduleOccurrence | null): string {
  if (!occurrence) return '在上课中'
  return `${occurrence.title} - ${formatTimeHm(occurrence.start)}-${formatTimeHm(occurrence.end)}`
}

export function shouldApplyStatusCardInClassOverride(
  activity: ActivityFeedItem | null,
): boolean {
  if (!activity) return false
  const screenState = getReportedScreenState(activity.metadata)
  if (screenState !== null) return screenState !== 'active'
  if (activity.isCustomOfflineStatus || activity.isCustomLockStatus) return true
  const source = [
    activity.statusText,
    activity.processTitle,
    activity.processName,
  ].map((value) => getTrimmedText(value)).join(' ').toLowerCase()
  return /锁屏|锁定|lock|locked|待机|暂离|离开|idle|standby|away|afk|休眠|睡觉|睡眠|睡了|晚安|sleep|sleeping|asleep|hibernate/.test(source)
}
