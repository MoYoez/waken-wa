'use client'

import { useAtom } from 'jotai'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useT } from 'next-i18next/client'
import type { ReactNode } from 'react'

import {
  getAdminPanelTransition,
  getAdminSectionVariants,
} from '@/components/admin/admin-motion'
import {
  WebSettingsInset,
  WebSettingsRow,
  WebSettingsRows,
} from '@/components/admin/web-settings-layout'
import {
  webSettingsFormAtom,
  webSettingsInspirationDevicesAtom,
  webSettingsRedisCacheServerlessForcedAtom,
} from '@/components/admin/web-settings-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  REDIS_ACTIVITY_FEED_CACHE_TTL_DEFAULT_SECONDS,
  REDIS_ACTIVITY_FEED_CACHE_TTL_MAX_SECONDS,
} from '@/lib/activity-api-constants'
import {
  ACTIVITY_UPDATE_MODE_OPTIONS,
  type ActivityUpdateMode,
} from '@/lib/activity-update-mode'
import {
  SITE_CONFIG_HISTORY_WINDOW_DEFAULT_MINUTES,
  SITE_CONFIG_HISTORY_WINDOW_MAX_MINUTES,
  SITE_CONFIG_HISTORY_WINDOW_MIN_MINUTES,
  SITE_CONFIG_PROCESS_STALE_DEFAULT_SECONDS,
  SITE_CONFIG_PROCESS_STALE_MAX_SECONDS,
  SITE_CONFIG_PROCESS_STALE_MIN_SECONDS,
} from '@/lib/site-config-constants'
import { TIMEZONE_OPTIONS } from '@/lib/timezone'

function ToggleRow(props: {
  id: string
  title: ReactNode
  description: ReactNode
  checked: boolean
  onCheckedChange: (value: boolean) => void
  disabled?: boolean
  className?: string
}) {
  const { id, title, description, checked, onCheckedChange, disabled, className } = props

  return (
    <WebSettingsRow
      htmlFor={id}
      title={title}
      description={description}
      className={className}
      action={
        <Switch
          id={id}
          checked={checked}
          onCheckedChange={onCheckedChange}
          disabled={disabled}
          className="shrink-0"
        />
      }
    />
  )
}

export function WebSettingsActivityPanel() {
  const { t } = useT('admin')
  const [form, setForm] = useAtom(webSettingsFormAtom)
  const [redisCacheServerlessForced] = useAtom(webSettingsRedisCacheServerlessForcedAtom)
  const [inspirationDevices] = useAtom(webSettingsInspirationDevicesAtom)
  const prefersReducedMotion = Boolean(useReducedMotion())
  const patch = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }
  const sectionTransition = getAdminPanelTransition(prefersReducedMotion)
  const sectionVariants = getAdminSectionVariants(prefersReducedMotion, {
    enterY: 10,
    exitY: 8,
    scale: 0.996,
  })

  return (
    <div className="space-y-4">
      <WebSettingsRows>
        <ToggleRow
          id="global-mouse-tilt"
          title={t('webSettingsActivity.globalMouseTiltTitle')}
          description={t('webSettingsActivity.globalMouseTiltDescription')}
          checked={form.globalMouseTiltEnabled}
          onCheckedChange={(value) => patch('globalMouseTiltEnabled', value)}
        />

        <AnimatePresence initial={false}>
          {form.globalMouseTiltEnabled ? (
            <motion.div
              variants={sectionVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={sectionTransition}
              layout
            >
              <ToggleRow
                id="global-mouse-tilt-gyro"
                title={t('webSettingsActivity.globalMouseTiltGyroTitle')}
                description={t('webSettingsActivity.globalMouseTiltGyroDescription')}
                checked={form.globalMouseTiltGyroEnabled}
                onCheckedChange={(value) => patch('globalMouseTiltGyroEnabled', value)}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>

        <ToggleRow
          id="profile-online-pulse"
          title={t('webSettingsActivity.profileOnlinePulseTitle')}
          description={t('webSettingsActivity.profileOnlinePulseDescription')}
          checked={form.profileOnlinePulseEnabled}
          onCheckedChange={(value) => patch('profileOnlinePulseEnabled', value)}
        />

        <ToggleRow
          id="hide-activity-media"
          title={t('webSettingsActivity.hideActivityMediaTitle')}
          description={t('webSettingsActivity.hideActivityMediaDescription')}
          checked={form.hideActivityMedia}
          onCheckedChange={(value) => patch('hideActivityMedia', value)}
        />

        <ToggleRow
          id="activity-reject-lockapp-sleep"
          title={t('webSettingsActivity.activityRejectLockappSleepTitle')}
          description={t('webSettingsActivity.activityRejectLockappSleepDescription')}
          checked={form.activityRejectLockappSleep}
          onCheckedChange={(value) => patch('activityRejectLockappSleep', value)}
        />

        <ToggleRow
          id="force-display-timezone"
          title={t('webSettingsActivity.forceDisplayTimezoneTitle')}
          description={t('webSettingsActivity.forceDisplayTimezoneDescription')}
          checked={form.forceDisplayTimezone}
          onCheckedChange={(value) => patch('forceDisplayTimezone', value)}
        />
      </WebSettingsRows>

      <WebSettingsInset className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="profile-online-accent">
            {t('webSettingsActivity.profileOnlineAccentLabel')}
          </Label>
          <p className="text-xs text-muted-foreground">
            {t('webSettingsActivity.profileOnlineAccentHint')}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <input
              id="profile-online-accent"
              type="color"
              className="h-9 w-14 cursor-pointer rounded-md border border-input bg-background p-1 shadow-xs"
              value={form.profileOnlineAccentColor || '#22C55E'}
              onChange={(event) =>
                patch('profileOnlineAccentColor', event.target.value.toUpperCase())
              }
              aria-label={t('webSettingsActivity.profileOnlineAccentAriaLabel')}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => patch('profileOnlineAccentColor', '')}
            >
              {t('webSettingsActivity.useThemeDefault')}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="display-timezone">{t('webSettingsActivity.displayTimezoneLabel')}</Label>
          <p className="text-xs text-muted-foreground">
            {t('webSettingsActivity.displayTimezoneHint')}
          </p>
          <Select value={form.displayTimezone} onValueChange={(value) => patch('displayTimezone', value)}>
            <SelectTrigger id="display-timezone" className="w-full sm:max-w-xs">
              <SelectValue placeholder={t('webSettingsActivity.displayTimezonePlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONE_OPTIONS.map((timezone) => (
              <SelectItem key={timezone.value} value={timezone.value}>
                  {t(timezone.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </WebSettingsInset>

      <WebSettingsInset className="space-y-3">
        <Label htmlFor="activity-update-mode">{t('webSettingsActivity.updateModeLabel')}</Label>
        <p className="text-xs text-muted-foreground">
          {t('webSettingsActivity.updateModeHint')}
        </p>
        <RadioGroup
          value={form.activityUpdateMode}
          onValueChange={(value) => patch('activityUpdateMode', value as ActivityUpdateMode)}
          className="space-y-3"
        >
          {ACTIVITY_UPDATE_MODE_OPTIONS.map((option) => (
            <div key={option.value} className="flex items-start gap-3">
              <RadioGroupItem value={option.value} id={`update-mode-${option.value}`} className="mt-1" />
              <div className="flex-1 space-y-1">
                <Label htmlFor={`update-mode-${option.value}`} className="font-medium cursor-pointer">
                  {t(`webSettingsActivity.updateModes.${option.value}.label`)}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t(`webSettingsActivity.updateModes.${option.value}.description`)}
                </p>
                {option.warning ? (
                  <div className="mt-2 rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2">
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      <span className="font-semibold">{t('webSettingsActivity.warningLabel')}</span>
                      {t(`webSettingsActivity.updateModes.${option.value}.warning`)}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </RadioGroup>
      </WebSettingsInset>

      <WebSettingsInset className="space-y-4">
        <div className="space-y-3">
          <ToggleRow
            id="use-nosql-as-cache-redis"
            title={t('webSettingsActivity.redisCacheTitle')}
            description={t('webSettingsActivity.redisCacheDescription')}
            checked={form.useNoSqlAsCacheRedis}
            onCheckedChange={(value) => patch('useNoSqlAsCacheRedis', value)}
            disabled={redisCacheServerlessForced}
            className="px-0 py-0 sm:px-0"
          />

          <AnimatePresence initial={false}>
            {redisCacheServerlessForced ? (
              <motion.div
                className="rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2"
                variants={sectionVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={sectionTransition}
                layout
              >
                <p className="text-xs leading-relaxed text-amber-700 dark:text-amber-400">
                  {t('webSettingsActivity.redisCacheServerlessForced')}
                </p>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        <div className="space-y-2">
          <Label htmlFor="redis-cache-ttl-seconds">{t('webSettingsActivity.redisCacheTtlLabel')}</Label>
          <Input
            id="redis-cache-ttl-seconds"
            type="number"
            onWheel={(event) => event.currentTarget.blur()}
            min={1}
            max={REDIS_ACTIVITY_FEED_CACHE_TTL_MAX_SECONDS}
            value={form.redisCacheTtlSeconds}
            onChange={(event) =>
              patch(
                'redisCacheTtlSeconds',
                Number(event.target.value || REDIS_ACTIVITY_FEED_CACHE_TTL_DEFAULT_SECONDS),
              )
            }
          />
          <p className="text-xs text-muted-foreground">
            {t('webSettingsActivity.redisCacheTtlHint')}
          </p>
        </div>
      </WebSettingsInset>

      <WebSettingsInset className="space-y-4">
        <WebSettingsRow
          htmlFor="steam-enabled"
          title={t('webSettingsActivity.steamTitle')}
          description={t('webSettingsActivity.steamDescription')}
          className="px-0 py-0 sm:px-0"
          action={
            <Switch
              id="steam-enabled"
              checked={form.steamEnabled}
              onCheckedChange={(value) => patch('steamEnabled', value)}
            />
          }
        />

        <AnimatePresence initial={false}>
          {form.steamEnabled ? (
            <motion.div
              className="space-y-3 border-t border-border pt-3"
              variants={sectionVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={sectionTransition}
              layout
            >
              <div className="space-y-2">
                <Label htmlFor="steam-id">{t('webSettingsActivity.steamIdLabel')}</Label>
                <Input
                  id="steam-id"
                  value={form.steamId}
                  onChange={(event) => patch('steamId', event.target.value)}
                  placeholder={t('webSettingsActivity.steamIdPlaceholder')}
                />
                <p className="text-xs text-muted-foreground">
                  {t('webSettingsActivity.steamIdHintPrefix')}{' '}
                  <a
                    href="https://steamid.io/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    steamid.io
                  </a>
                  {t('webSettingsActivity.steamIdHintSuffix')}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="steam-api-key">{t('webSettingsActivity.steamApiKeyLabel')}</Label>
                <Input
                  id="steam-api-key"
                  autoComplete="off"
                  value={form.steamApiKey}
                  onChange={(event) => patch('steamApiKey', event.target.value)}
                  placeholder={t('webSettingsActivity.steamApiKeyPlaceholder')}
                />
                <p className="text-xs text-muted-foreground">
                  {t('webSettingsActivity.steamApiKeyHintPrefix')}{' '}
                  <a
                    href="https://steamcommunity.com/dev/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    steamcommunity.com/dev/apikey
                  </a>
                  {t('webSettingsActivity.steamApiKeyHintSuffix')}
                </p>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </WebSettingsInset>

      <WebSettingsInset className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="history-window-minutes">{t('webSettingsActivity.historyWindowLabel')}</Label>
          <Input
            id="history-window-minutes"
            type="number"
            onWheel={(event) => event.currentTarget.blur()}
            min={SITE_CONFIG_HISTORY_WINDOW_MIN_MINUTES}
            max={SITE_CONFIG_HISTORY_WINDOW_MAX_MINUTES}
            value={form.historyWindowMinutes}
            onChange={(event) =>
              patch(
                'historyWindowMinutes',
                Number(event.target.value || SITE_CONFIG_HISTORY_WINDOW_DEFAULT_MINUTES),
              )
            }
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="process-stale-seconds">{t('webSettingsActivity.processStaleLabel')}</Label>
          <Input
            id="process-stale-seconds"
            type="number"
            onWheel={(event) => event.currentTarget.blur()}
            min={SITE_CONFIG_PROCESS_STALE_MIN_SECONDS}
            max={SITE_CONFIG_PROCESS_STALE_MAX_SECONDS}
            value={form.processStaleSeconds}
            onChange={(event) =>
              patch(
                'processStaleSeconds',
                Number(event.target.value || SITE_CONFIG_PROCESS_STALE_DEFAULT_SECONDS),
              )
            }
          />
          <p className="text-xs text-muted-foreground">
            {t('webSettingsActivity.processStaleHint', {
              value: SITE_CONFIG_PROCESS_STALE_DEFAULT_SECONDS,
            })}
          </p>
        </div>
      </WebSettingsInset>

      <WebSettingsRows>
        <ToggleRow
          id="auto-accept-new-devices"
          title={t('webSettingsActivity.autoAcceptNewDevicesTitle')}
          description={t('webSettingsActivity.autoAcceptNewDevicesDescription')}
          checked={form.autoAcceptNewDevices}
          onCheckedChange={(value) => patch('autoAcceptNewDevices', value)}
        />
      </WebSettingsRows>

      <WebSettingsInset className="space-y-4">
        <ToggleRow
          id="inspiration-device-restriction"
          title={t('webSettingsActivity.inspirationDeviceRestrictionTitle')}
          description={
            <>
              {t('webSettingsActivity.inspirationDeviceRestrictionDescriptionPrefix')}{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-[11px]">X-Device-Key</code>
              {t('webSettingsActivity.inspirationDeviceRestrictionDescriptionMiddle')}{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-[11px]">generatedHashKey</code>
              {t('webSettingsActivity.inspirationDeviceRestrictionDescriptionSuffix')}
            </>
          }
          checked={form.inspirationDeviceRestrictionEnabled}
          onCheckedChange={(value) => patch('inspirationDeviceRestrictionEnabled', value)}
          className="px-0 py-0 sm:px-0"
        />

        <AnimatePresence initial={false}>
          {form.inspirationDeviceRestrictionEnabled ? (
            <motion.div
              className="max-h-52 space-y-2 overflow-y-auto rounded-lg border border-border/60 bg-background/60 p-3"
              variants={sectionVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={sectionTransition}
              layout
            >
              {inspirationDevices.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {t('webSettingsActivity.inspirationDevicesEmpty')}
                </p>
              ) : (
                inspirationDevices.map((device) => (
                  <label key={device.id} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.inspirationAllowedDeviceHashes.includes(device.generatedHashKey)}
                      onChange={(event) => {
                        const key = device.generatedHashKey
                        const next = event.target.checked
                          ? Array.from(new Set([...form.inspirationAllowedDeviceHashes, key]))
                          : form.inspirationAllowedDeviceHashes.filter((item) => item !== key)
                        patch('inspirationAllowedDeviceHashes', next)
                      }}
                    />
                    <span className="min-w-0 flex-1 truncate font-medium">{device.displayName}</span>
                    <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                      {device.generatedHashKey.slice(0, 10)}…
                    </span>
                    {device.status !== 'active' ? (
                      <span className="shrink-0 text-xs text-amber-600">
                        ({t(`devices.status.${device.status}`)})
                      </span>
                    ) : null}
                  </label>
                ))
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </WebSettingsInset>
    </div>
  )
}
