import {
  ACTIVITY_METADATA_MAX_JSON_LENGTH,
  ACTIVITY_METADATA_MAX_KEYS,
  DEVICE_BATTERY_PERCENT_MAX,
  DEVICE_BATTERY_PERCENT_MIN,
} from '@/lib/activity-api-constants'
import {
  DEVICE_BATTERY_CHARGING_METADATA_KEY,
  parseIsChargingFromBody,
} from '@/lib/activity-battery-metadata'
import {
  ADMIN_PERSIST_SECONDS_METADATA_KEY,
  USER_ACTIVITY_DB_SYNCED_METADATA_KEY,
  USER_PERSIST_EXPIRES_AT_METADATA_KEY,
} from '@/lib/activity-store'
import { USER_ACTIVITY_PERSIST_MAX_SEC, USER_ACTIVITY_PERSIST_MIN_SEC } from '@/lib/user-activity-persist'

type ParseActivityReportOptions = {
  stripMetadataKeysBeforeValidate?: string[]
  stripMetadataKeysAfterNormalize?: string[]
}

type ParseActivityReportSuccess = {
  ok: true
  data: {
    generatedHashKey: string
    device: string
    processName: string
    processTitle: string | null
    metadata: Record<string, unknown> | null
  }
}

type ParseActivityReportFailure = {
  ok: false
  error: string
  status: number
}

type ParseActivityReportResult = ParseActivityReportSuccess | ParseActivityReportFailure

function removeMetadataKeys(
  metadata: Record<string, unknown> | null,
  keys: string[] | undefined,
) {
  if (!metadata || !keys || keys.length === 0) {
    return metadata
  }

  for (const key of keys) {
    delete metadata[key]
  }

  return metadata
}

export function parseActivityReportBody(
  body: Record<string, unknown>,
  options: ParseActivityReportOptions = {},
): ParseActivityReportResult {
  const generatedHashKeyRaw = body.generatedHashKey
  const deviceRaw = body.device
  const processNameRaw = body.process_name
  const processTitleRaw = body.process_title
  const batteryRaw = body.battery_level ?? body.device_battery
  const deviceTypeRaw = body.device_type
  const pushModeRaw = body.push_mode
  const metadataRaw = body.metadata

  const generatedHashKey =
    typeof generatedHashKeyRaw === 'string'
      ? generatedHashKeyRaw.trim()
      : ''
  const device =
    typeof deviceRaw === 'string'
      ? deviceRaw.trim()
      : 'Unknown Device'
  const processName =
    typeof processNameRaw === 'string'
      ? processNameRaw.trim()
      : ''
  const processTitle =
    typeof processTitleRaw === 'string'
      ? processTitleRaw.trim()
      : null

  let metadata: Record<string, unknown> | null = null
  if (metadataRaw && typeof metadataRaw === 'object' && !Array.isArray(metadataRaw)) {
    metadata = { ...(metadataRaw as Record<string, unknown>) }
    metadata = removeMetadataKeys(metadata, options.stripMetadataKeysBeforeValidate)
    if (!metadata) {
      metadata = {}
    }

    const metaKeys = Object.keys(metadata)
    if (
      metaKeys.length > ACTIVITY_METADATA_MAX_KEYS ||
      JSON.stringify(metadata).length > ACTIVITY_METADATA_MAX_JSON_LENGTH
    ) {
      return { ok: false, error: 'metadata 数据过大', status: 400 }
    }
  }

  if (typeof batteryRaw === 'number' && Number.isFinite(batteryRaw)) {
    metadata = {
      ...(metadata || {}),
      deviceBatteryPercent: Math.min(
        Math.max(Math.round(batteryRaw), DEVICE_BATTERY_PERCENT_MIN),
        DEVICE_BATTERY_PERCENT_MAX,
      ),
    }
  }

  const isCharging = parseIsChargingFromBody(body)
  if (isCharging !== undefined) {
    metadata = {
      ...(metadata || {}),
      [DEVICE_BATTERY_CHARGING_METADATA_KEY]: isCharging,
    }
  }

  if (typeof deviceTypeRaw === 'string') {
    const normalizedType = deviceTypeRaw.trim().toLowerCase()
    if (normalizedType === 'mobile' || normalizedType === 'tablet' || normalizedType === 'desktop') {
      metadata = {
        ...(metadata || {}),
        deviceType: normalizedType,
      }
    }
  }

  if (typeof pushModeRaw === 'string') {
    const normalizedMode = pushModeRaw.trim().toLowerCase()
    if (normalizedMode === 'realtime' || normalizedMode === 'active' || normalizedMode === 'persistent') {
      metadata = {
        ...(metadata || {}),
        pushMode: normalizedMode === 'persistent' ? 'active' : normalizedMode,
      }
    }
  }

  metadata = removeMetadataKeys(metadata, options.stripMetadataKeysAfterNormalize)

  return {
    ok: true,
    data: {
      generatedHashKey,
      device,
      processName,
      processTitle,
      metadata,
    },
  }
}

export function parseAdminPersistSeconds(body: Record<string, unknown>) {
  const persistMinutesRaw = body.persist_minutes ?? body.persistMinutes
  if (persistMinutesRaw === undefined || persistMinutesRaw === null) {
    return undefined
  }

  const mins = Number(persistMinutesRaw)
  if (!Number.isFinite(mins) || mins <= 0) {
    return undefined
  }

  const seconds = Math.round(mins * 60)
  return Math.min(
    Math.max(seconds, USER_ACTIVITY_PERSIST_MIN_SEC),
    USER_ACTIVITY_PERSIST_MAX_SEC,
  )
}

export const ADMIN_ACTIVITY_RESERVED_METADATA_KEYS = [
  ADMIN_PERSIST_SECONDS_METADATA_KEY,
  USER_PERSIST_EXPIRES_AT_METADATA_KEY,
  USER_ACTIVITY_DB_SYNCED_METADATA_KEY,
]

export const PUBLIC_ACTIVITY_RESERVED_METADATA_KEYS = [
  USER_PERSIST_EXPIRES_AT_METADATA_KEY,
  USER_ACTIVITY_DB_SYNCED_METADATA_KEY,
]
