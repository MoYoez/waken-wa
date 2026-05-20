import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { AdminDeviceSummary } from '@/types'

type DeviceCustomStatusDialogT = (
  key: string,
  values?: Record<string, string | number>,
) => string

function FilterBypassDevices(
  devices: AdminDeviceSummary[],
  searchInput: string,
): AdminDeviceSummary[] {
  const search = searchInput.trim().toLowerCase()
  if (!search) return devices
  return devices.filter((item) => {
    const displayName = item.displayName.toLowerCase()
    const hashKey = item.generatedHashKey.toLowerCase()
    return displayName.includes(search) || hashKey.includes(search)
  })
}

function DeviceCustomStatusBypassOptions({
  selectedKeys,
  bypassDevices,
  bypassSearch,
  title,
  description,
  t,
  onBypassSearchChange,
  onChange,
}: {
  selectedKeys: string[]
  bypassDevices: AdminDeviceSummary[]
  bypassSearch: string
  title: string
  description: string
  t: DeviceCustomStatusDialogT
  onBypassSearchChange: (value: string) => void
  onChange: (keys: string[]) => void
}) {
  const filteredBypassDevices = FilterBypassDevices(bypassDevices, bypassSearch)

  return (
    <div className="space-y-2 rounded-md border border-dashed border-border bg-background/70 p-3">
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Input
        value={bypassSearch}
        onChange={(event) => onBypassSearchChange(event.target.value)}
        placeholder={t('devices.customStatus.bypassSearchPlaceholder')}
        className="h-8"
      />
      <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
        {bypassDevices.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {t('devices.customStatus.noBypassDevices')}
          </p>
        ) : filteredBypassDevices.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {t('devices.customStatus.noBypassDevicesMatched')}
          </p>
        ) : (
          filteredBypassDevices.map((device) => {
            const checked = selectedKeys.includes(device.generatedHashKey)
            return (
              <label
                key={device.id}
                className="flex cursor-pointer items-start gap-3 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted/30"
              >
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={checked}
                  onChange={(event) => {
                    if (event.target.checked) {
                      onChange([...selectedKeys, device.generatedHashKey])
                      return
                    }
                    onChange(
                      selectedKeys.filter(
                        (key) => key !== device.generatedHashKey,
                      ),
                    )
                  }}
                />
                <span className="min-w-0">
                  <span className="block break-words font-medium">
                    {device.displayName}
                  </span>
                  <span className="block break-all text-[11px] text-muted-foreground">
                    {device.generatedHashKey}
                  </span>
                </span>
              </label>
            )
          })
        )}
      </div>
    </div>
  )
}

export function DeviceCustomStatusDialog({
  open,
  saving,
  customOfflineStatus,
  customOfflineStatusEnabled,
  customOfflineStatusBypassOnlineDeviceKeys,
  customLockStatus,
  customLockStatusEnabled,
  customLockStatusBypassOnlineDeviceKeys,
  customStatusBypassSearch,
  bypassDevices,
  t,
  onOpenChange,
  onCustomOfflineStatusChange,
  onCustomOfflineStatusEnabledChange,
  onCustomOfflineStatusBypassOnlineDeviceKeysChange,
  onCustomLockStatusChange,
  onCustomLockStatusEnabledChange,
  onCustomLockStatusBypassOnlineDeviceKeysChange,
  onCustomStatusBypassSearchChange,
  onSave,
}: {
  open: boolean
  saving: boolean
  customOfflineStatus: string
  customOfflineStatusEnabled: boolean
  customOfflineStatusBypassOnlineDeviceKeys: string[]
  customLockStatus: string
  customLockStatusEnabled: boolean
  customLockStatusBypassOnlineDeviceKeys: string[]
  customStatusBypassSearch: string
  bypassDevices: AdminDeviceSummary[]
  t: DeviceCustomStatusDialogT
  onOpenChange: (open: boolean) => void
  onCustomOfflineStatusChange: (value: string) => void
  onCustomOfflineStatusEnabledChange: (value: boolean) => void
  onCustomOfflineStatusBypassOnlineDeviceKeysChange: (keys: string[]) => void
  onCustomLockStatusChange: (value: string) => void
  onCustomLockStatusEnabledChange: (value: boolean) => void
  onCustomLockStatusBypassOnlineDeviceKeysChange: (keys: string[]) => void
  onCustomStatusBypassSearchChange: (value: string) => void
  onSave: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[min(92vh,52rem)] flex-col overflow-hidden sm:max-w-lg"
        showCloseButton
      >
        <DialogHeader>
          <DialogTitle>{t('devices.customStatus.title')}</DialogTitle>
          <DialogDescription>
            {t('devices.customStatus.description')}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 space-y-4 overflow-y-auto pr-1">
          <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="custom-offline-enabled"
                className="text-sm font-medium cursor-pointer"
              >
                {t('devices.customStatus.offlineTitle')}
              </Label>
              <Switch
                id="custom-offline-enabled"
                checked={customOfflineStatusEnabled}
                onCheckedChange={onCustomOfflineStatusEnabledChange}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {t('devices.customStatus.offlineDescription')}
            </p>
            <div className="space-y-2">
              <Input
                value={customOfflineStatus}
                onChange={(event) =>
                  onCustomOfflineStatusChange(event.target.value)
                }
                placeholder={t('devices.customStatus.offlinePlaceholder')}
                maxLength={100}
                disabled={!customOfflineStatusEnabled}
              />
              <p className="text-xs text-muted-foreground">
                {t('devices.customStatus.maxLength', { max: 100 })} (
                {customOfflineStatus.length}/100)
              </p>
            </div>
            <DeviceCustomStatusBypassOptions
              selectedKeys={customOfflineStatusBypassOnlineDeviceKeys}
              bypassDevices={bypassDevices}
              bypassSearch={customStatusBypassSearch}
              title={t('devices.customStatus.offlineBypassTitle')}
              description={t('devices.customStatus.offlineBypassDescription')}
              t={t}
              onBypassSearchChange={onCustomStatusBypassSearchChange}
              onChange={onCustomOfflineStatusBypassOnlineDeviceKeysChange}
            />
          </div>

          <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="custom-lock-enabled"
                className="text-sm font-medium cursor-pointer"
              >
                {t('devices.customStatus.lockTitle')}
              </Label>
              <Switch
                id="custom-lock-enabled"
                checked={customLockStatusEnabled}
                onCheckedChange={onCustomLockStatusEnabledChange}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {t('devices.customStatus.lockDescription')}
            </p>
            <div className="space-y-2">
              <Input
                value={customLockStatus}
                onChange={(event) =>
                  onCustomLockStatusChange(event.target.value)
                }
                placeholder={t('devices.customStatus.lockPlaceholder')}
                maxLength={100}
                disabled={!customLockStatusEnabled}
              />
              <p className="text-xs text-muted-foreground">
                {t('devices.customStatus.maxLength', { max: 100 })} (
                {customLockStatus.length}/100)
              </p>
            </div>
            <DeviceCustomStatusBypassOptions
              selectedKeys={customLockStatusBypassOnlineDeviceKeys}
              bypassDevices={bypassDevices}
              bypassSearch={customStatusBypassSearch}
              title={t('devices.customStatus.lockBypassTitle')}
              description={t('devices.customStatus.lockBypassDescription')}
              t={t}
              onBypassSearchChange={onCustomStatusBypassSearchChange}
              onChange={onCustomLockStatusBypassOnlineDeviceKeysChange}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="button" onClick={onSave} disabled={saving}>
            {saving ? t('common.saving') : t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
