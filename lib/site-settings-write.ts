import 'server-only'

import { like } from 'drizzle-orm'

import {
  SITE_SETTINGS_CLEAR_LEGACY_SITE_CONFIG_VALUES,
  SITE_SETTINGS_COMPAT_WRITE_BLOCKED_KEYS,
  SITE_SETTINGS_MIGRATED_CORE_KEYS,
  SITE_SETTINGS_RULES_KEYS,
  SITE_SETTINGS_SITE_CONFIG_ID,
} from '@/constants/site-settings'
import { SKILLS_SECRET_KEYS } from '@/constants/skills'
import { clearActivityFeedDataCache } from '@/lib/activity-feed'
import { db } from '@/lib/db'
import {
  rateLimitBackups,
  siteSettingsMigrationMeta,
  systemSecrets,
} from '@/lib/drizzle-schema'
import { safeSiteConfigUpsert } from '@/lib/safe-site-config-upsert'
import { clearSiteConfigCaches } from '@/lib/site-config-cache'
import { normalizeSiteConfigShape } from '@/lib/site-config-normalize'
import { readLegacySiteConfigRow } from '@/lib/site-config-v2'
import { sanitizeSiteConfigImagesForClient } from '@/lib/site-image-urls'
import {
  readEffectiveSiteConfig,
  readSiteSettingsMigrationSnapshot,
  readSiteSettingsSnapshot,
} from '@/lib/site-settings-read'
import {
  hasAnyRecordKey,
  pickRecordKeys,
} from '@/lib/site-settings-record'
import { ReplaceSiteConfigCoreEntries } from '@/lib/site-settings-write-core'
import { ReplaceRulesSettingsRows } from '@/lib/site-settings-write-rules'
import { ReplaceScheduleSettingsRows } from '@/lib/site-settings-write-schedule'
import { ReplaceThemeSettingsRows } from '@/lib/site-settings-write-theme'
import {
  CreateSiteSettingsCategoryApiRequiredError,
  CreateSiteSettingsConflictError,
  CreateSiteSettingsMigrationRequiredError,
  CreateSiteSettingsNotFoundError,
  WithSiteSettingsTransaction,
} from '@/lib/site-settings-write-utils'
import { sqlTimestamp } from '@/lib/sql-timestamp'
import type {
  SiteSettingsMigrationState,
  SiteSettingsRecord,
} from '@/types/site-settings'

async function clearSiteSettingsCaches(): Promise<void> {
  await Promise.all([clearSiteConfigCaches(), clearActivityFeedDataCache()])
}


async function upsertMigrationMetaRow(
  executor: any,
  values: {
    migrationState: SiteSettingsMigrationState
    migratedAt?: unknown
    legacyDataClearedAt?: unknown
  },
): Promise<void> {
  const now = sqlTimestamp()
  await executor
    .insert(siteSettingsMigrationMeta)
    .values({
      siteConfigId: SITE_SETTINGS_SITE_CONFIG_ID,
      migrationState: values.migrationState,
      migratedAt: values.migratedAt ?? null,
      legacyDataClearedAt: values.legacyDataClearedAt ?? null,
      createdAt: now,
      updatedAt: now,
    } as never)
    .onConflictDoUpdate({
      target: siteSettingsMigrationMeta.siteConfigId,
      set: {
        migrationState: values.migrationState,
        migratedAt: values.migratedAt ?? null,
        legacyDataClearedAt: values.legacyDataClearedAt ?? null,
        updatedAt: now,
      } as never,
    })
}

async function clearLegacyAuxiliaryData(executor: any): Promise<void> {
  await executor
    .delete(systemSecrets)
    .where(
      like(
        systemSecrets.key,
        `${SKILLS_SECRET_KEYS.skillsOauthAuthorizeCodePrefix}%`,
      ),
    )

  await executor.delete(rateLimitBackups)
}

async function persistSiteConfigSubset(
  executor: any,
  preparedValues: SiteSettingsRecord,
  siteConfigKeys: readonly string[],
): Promise<void> {
  const update = pickRecordKeys(preparedValues, siteConfigKeys)
  if (Object.keys(update).length === 0) {
    return
  }

  await safeSiteConfigUpsert(
    {
      where: { id: SITE_SETTINGS_SITE_CONFIG_ID },
      update,
      create: {
        id: SITE_SETTINGS_SITE_CONFIG_ID,
        ...preparedValues,
      },
    },
    executor,
  )
}

async function readMigrationState(executor: any): Promise<SiteSettingsMigrationState> {
  return (await readSiteSettingsMigrationSnapshot(executor)).migrationState
}

function assertMigratedState(migrationState: SiteSettingsMigrationState): void {
  if (migrationState === 'legacy') {
    throw CreateSiteSettingsMigrationRequiredError()
  }
}

function hasPersistedSplitRows(
  snapshot: Awaited<ReturnType<typeof readSiteSettingsSnapshot>>,
): boolean {
  return (
    snapshot.coreSiteConfigRow !== null &&
    snapshot.themeRowCount > 0 &&
    snapshot.scheduleRowCount > 0 &&
    snapshot.rulesRowCount > 0
  )
}

async function writeAllV2SiteSettings(
  executor: any,
  values: SiteSettingsRecord,
): Promise<void> {
  await ReplaceSiteConfigCoreEntries(executor, values)
  await ReplaceThemeSettingsRows(executor, values)
  await ReplaceScheduleSettingsRows(executor, values)
  await ReplaceRulesSettingsRows(executor, values)
}

export async function persistThemeSettingsFromPrepared(
  preparedValues: SiteSettingsRecord,
  executor: any = db,
): Promise<Record<string, unknown> | null> {
  const migrationState = await readMigrationState(executor)
  assertMigratedState(migrationState)

  await WithSiteSettingsTransaction(executor, async (tx) => {
    await ReplaceThemeSettingsRows(tx, preparedValues)
  })

  await clearSiteSettingsCaches()
  const data = await readEffectiveSiteConfig()
  return data ? sanitizeSiteConfigImagesForClient(data, 'admin') : null
}

export async function persistCompatibilitySiteConfigValues(
  preparedValues: SiteSettingsRecord,
  requestedBody: SiteSettingsRecord,
  executor: any = db,
): Promise<Record<string, unknown> | null> {
  if (hasAnyRecordKey(requestedBody, SITE_SETTINGS_COMPAT_WRITE_BLOCKED_KEYS)) {
    const migrationState = await readMigrationState(executor)
    if (migrationState === 'legacy') {
      throw CreateSiteSettingsMigrationRequiredError()
    }
    throw CreateSiteSettingsCategoryApiRequiredError('This setting has moved to a category API. Use the new category save endpoint.')
  }

  const migrationState = await readMigrationState(executor)
  if (migrationState === 'legacy') {
    await persistSiteConfigSubset(executor, preparedValues, Object.keys(requestedBody))
  } else {
    await WithSiteSettingsTransaction(executor, async (tx) => {
      await ReplaceSiteConfigCoreEntries(tx, preparedValues)
    })
  }

  await clearSiteSettingsCaches()
  const data = await readEffectiveSiteConfig()
  return data ? sanitizeSiteConfigImagesForClient(data, 'admin') : null
}

export async function persistScheduleSettingsFromPrepared(
  preparedValues: SiteSettingsRecord,
  executor: any = db,
): Promise<Record<string, unknown> | null> {
  const migrationState = await readMigrationState(executor)
  assertMigratedState(migrationState)

  await WithSiteSettingsTransaction(executor, async (tx) => {
    await ReplaceScheduleSettingsRows(tx, preparedValues)
  })

  await clearSiteSettingsCaches()
  const data = await readEffectiveSiteConfig()
  return data ? sanitizeSiteConfigImagesForClient(data, 'admin') : null
}

export async function persistCoreSettingsFromPrepared(
  preparedValues: SiteSettingsRecord,
  requestedBody: SiteSettingsRecord,
  executor: any = db,
): Promise<Record<string, unknown> | null> {
  const migrationState = await readMigrationState(executor)

  if (
    migrationState === 'legacy' &&
    hasAnyRecordKey(requestedBody, SITE_SETTINGS_MIGRATED_CORE_KEYS)
  ) {
    throw CreateSiteSettingsMigrationRequiredError()
  }

  if (migrationState === 'legacy') {
    await persistSiteConfigSubset(executor, preparedValues, Object.keys(requestedBody))
  } else {
    await WithSiteSettingsTransaction(executor, async (tx) => {
      await ReplaceSiteConfigCoreEntries(tx, preparedValues)
    })
  }

  await clearSiteSettingsCaches()
  const data = await readEffectiveSiteConfig()
  return data ? sanitizeSiteConfigImagesForClient(data, 'admin') : null
}

export async function persistRulesSettingsValues(
  values: SiteSettingsRecord,
  executor: any = db,
): Promise<void> {
  const migrationState = await readMigrationState(executor)
  assertMigratedState(migrationState)

  const effectiveConfig = await readEffectiveSiteConfig(executor)
  if (!effectiveConfig) {
    throw CreateSiteSettingsNotFoundError('Site configuration not found. Please complete setup first.')
  }

  const mergedValues = {
    ...effectiveConfig,
    ...pickRecordKeys(values, SITE_SETTINGS_RULES_KEYS),
  }

  await WithSiteSettingsTransaction(executor, async (tx) => {
    await ReplaceRulesSettingsRows(tx, mergedValues)
  })

  await clearSiteSettingsCaches()
}

export async function bootstrapSiteSettingsSplitStorage(executor: any = db): Promise<void> {
  const snapshot = await readSiteSettingsSnapshot(executor)
  const legacySiteConfigRow = snapshot.legacySiteConfigRow ?? (await readLegacySiteConfigRow(executor))
  if (!legacySiteConfigRow) {
    throw CreateSiteSettingsNotFoundError('Site configuration not found. Please complete setup first.')
  }

  const sourceValues =
    snapshot.migration.migrationState === 'legacy'
      ? normalizeSiteConfigShape(legacySiteConfigRow)
      : await readEffectiveSiteConfig(executor)

  if (!sourceValues) {
    throw CreateSiteSettingsNotFoundError('Site configuration not found. Please complete setup first.')
  }

  const migratedAt = snapshot.migration.migratedAt ?? sqlTimestamp()
  const migrationState =
    snapshot.migration.migrationState === 'legacy_cleared' ? 'legacy_cleared' : 'migrated'

  await WithSiteSettingsTransaction(executor, async (tx) => {
    await writeAllV2SiteSettings(tx, sourceValues)
    await upsertMigrationMetaRow(tx, {
      migrationState,
      migratedAt,
      legacyDataClearedAt:
        migrationState === 'legacy_cleared'
          ? snapshot.migration.legacyDataClearedAt ?? null
          : null,
    })
  })

  await clearSiteSettingsCaches()
}

export async function migrateLegacySiteSettings(
  executor: any = db,
): Promise<{
  migrationState: SiteSettingsMigrationState
  changed: boolean
}> {
  const snapshot = await readSiteSettingsSnapshot(executor)
  if (!snapshot.legacySiteConfigRow) {
    throw CreateSiteSettingsNotFoundError('Site configuration not found. Please complete setup first.')
  }

  if (snapshot.migration.migrationState !== 'legacy') {
    if (!hasPersistedSplitRows(snapshot)) {
      await bootstrapSiteSettingsSplitStorage(executor)
      return {
        migrationState:
          snapshot.migration.migrationState === 'legacy_cleared'
            ? 'legacy_cleared'
            : 'migrated',
        changed: true,
      }
    }
    return {
      migrationState: snapshot.migration.migrationState,
      changed: false,
    }
  }

  await bootstrapSiteSettingsSplitStorage(executor)
  return {
    migrationState: 'migrated',
    changed: true,
  }
}

export async function clearLegacySiteSettingsData(
  executor: any = db,
): Promise<{
  migrationState: SiteSettingsMigrationState
  changed: boolean
}> {
  const snapshot = await readSiteSettingsSnapshot(executor)
  if (!snapshot.legacySiteConfigRow) {
    throw CreateSiteSettingsNotFoundError('Site configuration not found. Please complete setup first.')
  }

  if (snapshot.migration.migrationState === 'legacy') {
    throw CreateSiteSettingsMigrationRequiredError('Complete migration before clearing legacy data.')
  }
  if (snapshot.migration.migrationState === 'legacy_cleared') {
    throw CreateSiteSettingsConflictError('Legacy data has already been cleared.')
  }

  const effectiveConfig = await readEffectiveSiteConfig(executor)
  if (!effectiveConfig) {
    throw CreateSiteSettingsNotFoundError('Site configuration not found. Please complete setup first.')
  }

  const legacyDataClearedAt = sqlTimestamp()
  await WithSiteSettingsTransaction(executor, async (tx) => {
    await writeAllV2SiteSettings(tx, effectiveConfig)
    await clearLegacyAuxiliaryData(tx)
    await safeSiteConfigUpsert(
      {
        where: { id: SITE_SETTINGS_SITE_CONFIG_ID },
        update: SITE_SETTINGS_CLEAR_LEGACY_SITE_CONFIG_VALUES,
        create: {
          id: SITE_SETTINGS_SITE_CONFIG_ID,
          ...SITE_SETTINGS_CLEAR_LEGACY_SITE_CONFIG_VALUES,
        },
      },
      tx,
    )
    await upsertMigrationMetaRow(tx, {
      migrationState: 'legacy_cleared',
      migratedAt: snapshot.migration.migratedAt ?? null,
      legacyDataClearedAt,
    })
  })

  await clearSiteSettingsCaches()
  return {
    migrationState: 'legacy_cleared',
    changed: true,
  }
}
