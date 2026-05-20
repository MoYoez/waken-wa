import { Trash2 } from 'lucide-react'
import { motion, type Transition, type Variants } from 'motion/react'

import { DeviceListItemActions } from '@/components/admin/device-list-item-actions'
import { FormattedTime } from '@/components/formatted-time'
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
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import type { AdminDeviceItem } from '@/types'

type DeviceListItemT = (
  key: string,
  values?: Record<string, string | number>,
) => string

export function DeviceListItem({
  item,
  highlightHashKey,
  removePending,
  pinPending,
  steamPending,
  sectionVariants,
  sectionTransition,
  t,
  deviceStatusLabel,
  onCopyHash,
  onToggleActive,
  onReview,
  onRemoveDevice,
  onUpdatePinToTop,
  onUpdateShowSteamNowPlaying,
  onOpenCustomStatusEditor,
}: {
  item: AdminDeviceItem
  highlightHashKey?: string
  removePending: boolean
  pinPending: boolean
  steamPending: boolean
  sectionVariants: Variants
  sectionTransition: Transition
  t: DeviceListItemT
  deviceStatusLabel: (status: AdminDeviceItem['status']) => string
  onCopyHash: (hash: string) => void
  onToggleActive: (item: AdminDeviceItem) => void
  onReview: (item: AdminDeviceItem) => void
  onRemoveDevice: (id: number) => void
  onUpdatePinToTop: (id: number, pinToTop: boolean) => void
  onUpdateShowSteamNowPlaying: (
    id: number,
    showSteamNowPlaying: boolean,
  ) => void
  onOpenCustomStatusEditor: (item: AdminDeviceItem) => void
}) {
  const trimmedHighlightHashKey = highlightHashKey?.trim()
  const highlighted =
    Boolean(trimmedHighlightHashKey) &&
    item.generatedHashKey === trimmedHighlightHashKey

  return (
    <motion.div
      id={`device-row-${item.id}`}
      className={cn(
        'relative rounded-md border p-2.5 sm:p-3',
        highlighted ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : null,
      )}
      variants={sectionVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={sectionTransition}
      layout
    >
      <div className="pointer-events-none absolute right-1 top-1 z-10 sm:right-2 sm:top-2">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="pointer-events-auto h-8 w-8 text-muted-foreground hover:text-destructive"
              aria-label={t('devices.deleteDeviceAriaLabel')}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('devices.confirmDeleteDeviceTitle')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('devices.confirmDeleteDeviceDescription')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => onRemoveDevice(item.id)}
                disabled={removePending}
              >
                {t('common.delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      <div className="space-y-2">
        <div className="pr-10 sm:pr-11">
          <div className="min-w-0 space-y-1">
            <p className="font-medium break-words">{item.displayName}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="block sm:inline">
                {t('devices.deviceStatus', {
                  status: deviceStatusLabel(item.status),
                })}
              </span>
              <span className="hidden sm:inline">{' | '}</span>
              <span className="mt-0.5 block sm:mt-0 sm:inline">
                {t('devices.lastOnline')}{' '}
                <FormattedTime
                  date={item.lastSeenAt}
                  pattern="yyyy-MM-dd HH:mm:ss"
                  fallback="—"
                />
              </span>
            </p>
          </div>
          <div className="mt-3 sm:hidden">
            <DeviceListItemActions
              item={item}
              variant="mobile"
              t={t}
              onCopyHash={() => onCopyHash(item.generatedHashKey)}
              onToggleActive={() => onToggleActive(item)}
              onReview={() => onReview(item)}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          <span className="font-sans">{t('devices.identityLabel')} </span>
          <span className="font-mono break-all">{item.generatedHashKey}</span>
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <p className="text-xs text-muted-foreground min-w-0 sm:flex-1">
            {item.apiToken
              ? t('devices.tokenLabel', { name: item.apiToken.name })
              : t('devices.tokenUnboundNeedsReview')}
          </p>
          {!item.apiToken ? (
            <p className="text-[11px] text-amber-600 dark:text-amber-300 sm:flex-1">
              {t('devices.unboundCannotEnable')}
            </p>
          ) : null}
          <div className="hidden sm:block sm:shrink-0">
            <DeviceListItemActions
              item={item}
              variant="desktop"
              t={t}
              onCopyHash={() => onCopyHash(item.generatedHashKey)}
              onToggleActive={() => onToggleActive(item)}
              onReview={() => onReview(item)}
            />
          </div>
        </div>
        <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/20 px-2.5 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-3">
          <div className="min-w-0 flex-1 space-y-0.5">
            <Label
              htmlFor={`pin-to-top-${item.id}`}
              className="text-xs font-medium cursor-pointer"
            >
              {t('devices.pinToTopTitle')}
            </Label>
            <p className="text-[11px] text-muted-foreground leading-snug">
              {t('devices.pinToTopDescription')}
            </p>
          </div>
          <Switch
            id={`pin-to-top-${item.id}`}
            className="shrink-0 self-end sm:self-auto"
            checked={Boolean(item.pinToTop)}
            onCheckedChange={(value) => onUpdatePinToTop(item.id, value)}
            disabled={pinPending}
          />
        </div>
        <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/20 px-2.5 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-3">
          <div className="min-w-0 flex-1 space-y-0.5">
            <Label
              htmlFor={`steam-card-${item.id}`}
              className="text-xs font-medium cursor-pointer"
            >
              {t('devices.showSteamTitle')}
            </Label>
            <p className="text-[11px] text-muted-foreground leading-snug">
              {t('devices.showSteamDescription')}
            </p>
          </div>
          <Switch
            id={`steam-card-${item.id}`}
            className="shrink-0 self-end sm:self-auto"
            checked={Boolean(item.showSteamNowPlaying)}
            onCheckedChange={(value) =>
              onUpdateShowSteamNowPlaying(item.id, value)
            }
            disabled={steamPending}
          />
        </div>
        <div className="rounded-md border border-border bg-muted/20 px-2.5 py-2 sm:px-3">
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs font-medium">
              {t('devices.customStatusTitle')}
            </Label>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onOpenCustomStatusEditor(item)}
            >
              {t('devices.editCustomStatus')}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground leading-snug">
            {t('devices.customStatusDescription')}
          </p>
        </div>
      </div>
    </motion.div>
  )
}
