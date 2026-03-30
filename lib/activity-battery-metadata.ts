/** Stored on activity metadata when client sends top-level `is_charging` / `isCharging`. */
export const DEVICE_BATTERY_CHARGING_METADATA_KEY = 'deviceBatteryCharging' as const

/** Read explicit boolean from POST JSON; omit key in payload => do not update charging state on merge. */
export function parseIsChargingFromBody(body: unknown): boolean | undefined {
  if (body == null || typeof body !== 'object' || Array.isArray(body)) return undefined
  const b = body as Record<string, unknown>
  const raw = b.is_charging ?? b.isCharging
  if (typeof raw === 'boolean') return raw
  return undefined
}

export function isDeviceBatteryCharging(
  metadata: Record<string, unknown> | null | undefined,
): boolean {
  return (metadata as Record<string, unknown> | undefined)?.[
    DEVICE_BATTERY_CHARGING_METADATA_KEY
  ] === true
}
