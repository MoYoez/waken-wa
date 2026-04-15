import 'server-only'

export {
  type AppHistoryBuckets,
  flushPendingReportedAppHistory,
  recordReportedAppHistory,
} from '@/lib/activity-history-pending'
