/** Throttle device lastSeenAt writes to reduce write amplification during frequent reports. */
export const DEVICE_LAST_SEEN_WRITE_THROTTLE_MS = 30_000
