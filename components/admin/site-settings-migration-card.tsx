'use client'

import { useT } from 'next-i18next/client'

import type { SiteSettingsMigrationInfo } from '@/components/admin/web-settings-types'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

function formatMigrationTime(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

export function SiteSettingsMigrationCard({
  migration,
  pending = false,
  onMigrate,
  onClearLegacyData,
}: {
  migration: SiteSettingsMigrationInfo | null
  pending?: boolean
  onMigrate: () => void | Promise<void>
  onClearLegacyData: () => void | Promise<void>
}) {
  const { t } = useT('admin')

  if (!migration || migration.migrationState === 'legacy_cleared') {
    return null
  }

  const toneClassName =
    migration.migrationState === 'legacy'
      ? 'border-amber-500/30 bg-amber-500/8'
      : migration.migrationState === 'migrated'
        ? 'border-emerald-500/30 bg-emerald-500/8'
        : 'border-sky-500/30 bg-sky-500/8'

  return (
    <section className={cn('rounded-2xl border px-4 py-4 sm:px-5', toneClassName)}>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold tracking-wide text-foreground">
                {t('webSettingsMigration.title')}
              </h3>
              <Badge variant="secondary">
                {t(`webSettingsMigration.states.${migration.migrationState}`)}
              </Badge>
            </div>
            <p className="text-xs leading-6 text-muted-foreground">
              {t(`webSettingsMigration.descriptions.${migration.migrationState}`)}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {migration.canMigrate ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" size="sm" disabled={pending}>
                    {t('webSettingsMigration.actions.migrate')}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {t('webSettingsMigration.confirmMigrate.title')}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('webSettingsMigration.confirmMigrate.description')}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                    <AlertDialogAction
                      disabled={pending}
                      onClick={() => {
                        void onMigrate()
                      }}
                    >
                      {t('webSettingsMigration.confirmMigrate.confirm')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}

            {migration.canClearLegacyData ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" size="sm" variant="destructive" disabled={pending}>
                    {t('webSettingsMigration.actions.clearLegacyData')}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {t('webSettingsMigration.confirmClear.title')}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('webSettingsMigration.confirmClear.description')}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                    <AlertDialogAction
                      disabled={pending}
                      onClick={() => {
                        void onClearLegacyData()
                      }}
                    >
                      {t('webSettingsMigration.confirmClear.confirm')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}
          </div>
        </div>

        <dl className="grid gap-3 text-xs text-muted-foreground sm:grid-cols-2">
          <div className="rounded-xl border border-border/60 bg-background/70 px-3 py-3">
            <dt className="font-medium text-foreground">
              {t('webSettingsMigration.meta.migratedAt')}
            </dt>
            <dd className="mt-1 break-words leading-5">
              {formatMigrationTime(migration.migratedAt)}
            </dd>
          </div>
          <div className="rounded-xl border border-border/60 bg-background/70 px-3 py-3">
            <dt className="font-medium text-foreground">
              {t('webSettingsMigration.meta.legacyDataClearedAt')}
            </dt>
            <dd className="mt-1 break-words leading-5">
              {formatMigrationTime(migration.legacyDataClearedAt)}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  )
}
