'use client'

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { Copy, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useT } from 'next-i18next/client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import {
  getAdminPanelTransition,
  getAdminSectionVariants,
} from '@/components/admin/admin-motion'
import {
  fetchAdminDevicesPage,
  fetchAdminTokenOptions,
} from '@/components/admin/admin-query-fetchers'
import { adminQueryKeys as keys } from '@/components/admin/admin-query-keys'
import {
  createAdminDevice,
  deleteAdminDevice,
  patchAdminDevice,
} from '@/components/admin/admin-query-mutations'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { toastSwitchLabel } from '@/lib/admin-switch-toast'
import { cn } from '@/lib/utils'
import type { AdminDeviceItem, AdminTokenOption } from '@/types'

function DeviceListItemActions({
  item,
  variant,
  t,
  onCopyHash,
  onToggleActive,
  onReview,
}: {
  item: AdminDeviceItem
  variant: 'mobile' | 'desktop'
  t: (key: string, values?: Record<string, string | number>) => string
  onCopyHash: () => void
  onToggleActive: () => void
  onReview: () => void
}) {
  if (variant === 'mobile') {
    return (
      <div className="flex w-full flex-col gap-2">
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-9 h-auto gap-1.5 py-2"
            onClick={onCopyHash}
          >
            <Copy className="h-4 w-4 shrink-0" />
            <span className="truncate text-left">{t('devices.copyIdentity')}</span>
          </Button>
          <Button type="button" variant="outline" size="sm" className="min-h-9" onClick={onToggleActive}>
            {item.status === 'active' ? t('devices.disable') : t('devices.enable')}
          </Button>
        </div>
        {item.status === 'pending' ? (
          <Button type="button" variant="outline" size="sm" className="min-h-9 w-full" onClick={onReview}>
            {t('devices.review')}
          </Button>
        ) : null}
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5" onClick={onCopyHash}>
        <Copy className="h-4 w-4 shrink-0" />
        {t('devices.copyIdentity')}
      </Button>
      <Button type="button" variant="outline" size="sm" className="h-8" onClick={onToggleActive}>
        {item.status === 'active' ? t('devices.disable') : t('devices.enable')}
      </Button>
      {item.status === 'pending' ? (
        <Button type="button" variant="outline" size="sm" className="h-8" onClick={onReview}>
          {t('devices.review')}
        </Button>
      ) : null}
    </div>
  )
}

/** Server page size; smaller pages keep the admin panel from growing too tall. */
const DEVICE_LIST_PAGE_SIZE = 10
/** Max scroll height for the device list block inside the card. */
const DEVICE_LIST_MAX_HEIGHT = 'min(70vh,48rem)'

export function DeviceManager({
  initialHashKey,
  highlightHashKey,
}: {
  initialHashKey?: string
  highlightHashKey?: string
} = {}) {
  const { t } = useT('admin')
  const queryClient = useQueryClient()
  const prefersReducedMotion = Boolean(useReducedMotion())
  const [page, setPage] = useState(0)
  const [q, setQ] = useState(() => initialHashKey?.trim() ?? '')
  const [status, setStatus] = useState('')
  const [newName, setNewName] = useState('')
  const [newTokenId, setNewTokenId] = useState('')
  const [newHashKey, setNewHashKey] = useState('')
  const [reviewDeviceId, setReviewDeviceId] = useState<number | null>(null)
  const [reviewTokenId, setReviewTokenId] = useState('')
  const highlightHandledRef = useRef(false)

  const tokensQuery = useQuery({
    queryKey: keys.tokens.options(),
    queryFn: fetchAdminTokenOptions,
  })

  const devicesQuery = useQuery({
    queryKey: keys.devices.page({ page, q, status }),
    queryFn: () => fetchAdminDevicesPage({ page, q, status, pageSize: DEVICE_LIST_PAGE_SIZE }),
    placeholderData: keepPreviousData,
  })

  const items = useMemo(() => devicesQuery.data?.items ?? [], [devicesQuery.data?.items])
  const total = devicesQuery.data?.total ?? 0
  const loading = devicesQuery.isLoading
  const refreshing = devicesQuery.isFetching && !devicesQuery.isLoading
  const tokens = tokensQuery.data ?? []
  const reviewDevice = useMemo(
    () => (reviewDeviceId == null ? null : items.find((item) => item.id === reviewDeviceId) ?? null),
    [items, reviewDeviceId],
  )

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / DEVICE_LIST_PAGE_SIZE)),
    [total],
  )
  const safePage = useMemo(() => Math.min(page, Math.max(0, totalPages - 1)), [page, totalPages])
  const sectionTransition = getAdminPanelTransition(prefersReducedMotion)
  const sectionVariants = getAdminSectionVariants(prefersReducedMotion, {
    enterY: 10,
    exitY: 8,
    scale: 0.996,
  })
  const deviceStatusLabel = (status: AdminDeviceItem['status']) => t(`devices.status.${status}`)

  useEffect(() => {
    if (page <= safePage) return
    const timer = window.setTimeout(() => {
      setPage(safePage)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [page, safePage])

  const refreshDevices = async () => {
    try {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'devices'] })
      await devicesQuery.refetch()
    } catch {
      toast.error(t('devices.refreshFailed'))
    }
  }

  const createDeviceMutation = useMutation({
    mutationFn: async () => {
      const apiTokenId = newTokenId ? Number(newTokenId) : undefined
      const body: Record<string, unknown> = {
        displayName: newName.trim(),
        apiTokenId: Number.isFinite(apiTokenId) ? apiTokenId : undefined,
      }
      const hk = newHashKey.trim()
      if (hk) body.generatedHashKey = hk
      await createAdminDevice({
        displayName: String(body.displayName),
        apiTokenId: typeof body.apiTokenId === 'number' ? body.apiTokenId : undefined,
        generatedHashKey: typeof body.generatedHashKey === 'string' ? body.generatedHashKey : undefined,
      })
    },
    onSuccess: async () => {
      const createdWithToken = Boolean(newTokenId)
      setNewName('')
      setNewTokenId('')
      setNewHashKey('')
      setPage(0)
      toast.success(
        createdWithToken
          ? t('devices.deviceCreatedWithToken')
          : t('devices.deviceCreatedPending'),
      )
      await queryClient.invalidateQueries({ queryKey: ['admin', 'devices'] })
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t('common.networkError'))
    },
  })

  const updateStatusMutation = useMutation({
    mutationFn: async ({
      id,
      nextStatus,
    }: {
      id: number
      nextStatus: 'active' | 'pending' | 'revoked'
    }) => {
      await patchAdminDevice({ id, status: nextStatus })
      return { id, nextStatus }
    },
    onSuccess: async ({ id, nextStatus }) => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'devices'] })
      setReviewDeviceId((deviceId) => (deviceId === id ? null : deviceId))
      toast.success(t('devices.statusUpdated', { status: deviceStatusLabel(nextStatus) }))
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t('common.networkError'))
    },
  })

  const updateSteamMutation = useMutation({
    mutationFn: async ({
      id,
      showSteamNowPlaying,
    }: {
      id: number
      showSteamNowPlaying: boolean
    }) => {
      await patchAdminDevice({ id, showSteamNowPlaying })
      return { showSteamNowPlaying }
    },
    onSuccess: async ({ showSteamNowPlaying }) => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'devices'] })
      toastSwitchLabel(t('devices.showSteamTitle'), showSteamNowPlaying)
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t('common.networkError'))
    },
  })

  const updateBindingMutation = useMutation({
    mutationFn: async ({ id, apiTokenId }: { id: number; apiTokenId: number | null }) => {
      await patchAdminDevice({ id, apiTokenId })
      return { id, apiTokenId }
    },
    onSuccess: async ({ apiTokenId }) => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'devices'] })
      if (apiTokenId == null) {
        toast.success(t('devices.bindingRemovedPending'))
      } else {
        toast.success(t('devices.bindingUpdated'))
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t('common.networkError'))
    },
  })

  const updatePinMutation = useMutation({
    mutationFn: async ({
      id,
      pinToTop,
    }: {
      id: number
      pinToTop: boolean
    }) => {
      await patchAdminDevice({ id, pinToTop })
      return { pinToTop }
    },
    onSuccess: async ({ pinToTop }) => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'devices'] })
      toastSwitchLabel(t('devices.pinToTopTitle'), pinToTop)
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t('common.networkError'))
    },
  })

  const removeDeviceMutation = useMutation({
    mutationFn: async (id: number) => {
      await deleteAdminDevice(id)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'devices'] })
      toast.success(t('devices.deviceDeleted'))
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t('common.networkError'))
    },
  })

  useEffect(() => {
    if (!highlightHashKey?.trim() || items.length === 0) return
    const match = items.find((i) => i.generatedHashKey === highlightHashKey.trim())
    if (!match) return
    const el = document.getElementById(`device-row-${match.id}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [highlightHashKey, items])

  const createDevice = async () => {
    if (!newName.trim()) return
    await createDeviceMutation.mutateAsync()
  }

  const updateStatus = async (id: number, nextStatus: 'active' | 'pending' | 'revoked') => {
    await updateStatusMutation.mutateAsync({ id, nextStatus })
  }

  const updateShowSteamNowPlaying = async (id: number, showSteamNowPlaying: boolean) => {
    await updateSteamMutation.mutateAsync({ id, showSteamNowPlaying })
  }

  const updatePinToTop = async (id: number, pinToTop: boolean) => {
    await updatePinMutation.mutateAsync({ id, pinToTop })
  }

  const updateBinding = async (id: number, apiTokenId: number | null) => {
    await updateBindingMutation.mutateAsync({ id, apiTokenId })
  }

  const removeDevice = async (id: number) => {
    await removeDeviceMutation.mutateAsync(id)
  }

  const openReview = (item: AdminDeviceItem) => {
    setReviewDeviceId(item.id)
    setReviewTokenId(item.apiToken?.id ? String(item.apiToken.id) : '')
  }

  const handleToggleActive = async (item: AdminDeviceItem) => {
    if (item.status === 'active') {
      await updateStatus(item.id, 'revoked')
      return
    }
    if (!item.apiToken) {
      toast.warning(t('devices.deviceNeedsToken'))
      openReview(item)
      return
    }
    await updateStatus(item.id, 'active')
  }

  const copyHash = async (hash: string) => {
    try {
      await navigator.clipboard.writeText(hash)
      toast.success(t('devices.identityCopied'))
    } catch {
      toast.error(t('common.copyFailedBrowserPermission'))
    }
  }

  useEffect(() => {
    const h = highlightHashKey?.trim()
    if (!h || loading) return
    if (highlightHandledRef.current) return

    const match = items.find((i) => i.generatedHashKey === h)
    if (match) {
      highlightHandledRef.current = true
      if (match.status === 'pending') {
        window.setTimeout(() => {
          setReviewDeviceId(match.id)
          setReviewTokenId(match.apiToken?.id ? String(match.apiToken.id) : '')
        }, 0)
      } else {
        toast.info(t('devices.deviceAlreadyReviewed'))
      }
      return
    }

    if (q.trim() !== h) return

    highlightHandledRef.current = true
    toast.warning(t('devices.deviceNotFound'))
  }, [highlightHashKey, loading, items, q, t])

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-4 space-y-4 sm:p-6">
        <div className="grid min-w-0 gap-4 sm:grid-cols-3">
          <div className="min-w-0 space-y-2 sm:col-span-2">
            <Label htmlFor="new-device-name">{t('devices.displayName')}</Label>
            <Input
              id="new-device-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t('devices.displayNamePlaceholder')}
            />
          </div>
          <div className="min-w-0 space-y-2">
            <Label htmlFor="new-device-token">{t('devices.bindTokenRecommended')}</Label>
            <Select
              value={newTokenId || 'none'}
              onValueChange={(v) => setNewTokenId(v === 'none' ? '' : v)}
            >
              <SelectTrigger id="new-device-token" className="w-full">
                <SelectValue placeholder={t('devices.selectTokenFirst')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('devices.bindLaterPending')}</SelectItem>
                {tokens.map((tokenOption) => (
                  <SelectItem key={tokenOption.id} value={String(tokenOption.id)}>
                    {tokenOption.name}
                    {!tokenOption.isActive ? t('devices.disabledTokenSuffix') : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="min-w-0 space-y-2">
          <Label htmlFor="new-device-hash">{t('devices.customIdentityOptional')}</Label>
          <Input
            id="new-device-hash"
            value={newHashKey}
            onChange={(e) => setNewHashKey(e.target.value)}
            placeholder={t('devices.customIdentityPlaceholder')}
            className="font-mono text-xs"
          />
          <p className="break-words text-xs text-muted-foreground">
            {t('devices.customIdentityHint')}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <Button
            type="button"
            className="w-full sm:w-auto"
            onClick={() => void createDevice()}
            disabled={createDeviceMutation.isPending || !newName.trim()}
          >
            <Plus className="h-4 w-4 mr-1" />
            {createDeviceMutation.isPending ? t('devices.creating') : t('devices.addDevice')}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => void refreshDevices()}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            {refreshing ? t('common.refreshing') : t('common.refresh')}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4 sm:p-6 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-0 flex-1 space-y-2">
            <Label htmlFor="device-q">{t('devices.search')}</Label>
            <Input
              id="device-q"
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setPage(0)
              }}
              placeholder={t('devices.searchPlaceholder')}
            />
          </div>
          <div className="w-full space-y-2 sm:w-auto">
            <Label htmlFor="device-status">{t('devices.statusLabel')}</Label>
            <Select
              value={status || 'all'}
              onValueChange={(v) => {
                setStatus(v === 'all' ? '' : v)
                setPage(0)
              }}
            >
              <SelectTrigger
                id="device-status"
                className="w-full min-w-0 sm:w-[11rem] sm:min-w-[11rem]"
              >
                <SelectValue placeholder={t('devices.all')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('devices.all')}</SelectItem>
                <SelectItem value="active">{deviceStatusLabel('active')}</SelectItem>
                <SelectItem value="pending">{deviceStatusLabel('pending')}</SelectItem>
                <SelectItem value="revoked">{deviceStatusLabel('revoked')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {loading ? (
            <motion.p
              key="devices-loading"
              className="text-sm text-muted-foreground"
              variants={sectionVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={sectionTransition}
            >
              {t('common.loading')}
            </motion.p>
          ) : items.length === 0 && total > 0 ? (
            <motion.p
              key="devices-syncing"
              className="text-sm text-muted-foreground"
              variants={sectionVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={sectionTransition}
            >
              {t('devices.syncingPage')}
            </motion.p>
          ) : items.length === 0 ? (
            <motion.p
              key="devices-empty"
              className="text-sm text-muted-foreground"
              variants={sectionVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={sectionTransition}
            >
              {t('devices.noDevices')}
            </motion.p>
          ) : (
            <motion.div
              key="devices-list"
              className="space-y-3 overflow-y-auto overscroll-contain pr-1"
              style={{ maxHeight: DEVICE_LIST_MAX_HEIGHT }}
              layout
            >
              <AnimatePresence initial={false}>
                {items.map((item) => (
                  <motion.div
                    key={item.id}
                    id={`device-row-${item.id}`}
                    className={cn(
                      'relative rounded-md border p-2.5 sm:p-3',
                      highlightHashKey?.trim() && item.generatedHashKey === highlightHashKey.trim()
                        ? 'ring-2 ring-primary ring-offset-2 ring-offset-background'
                        : null,
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
                          onClick={() => void removeDevice(item.id)}
                          disabled={removeDeviceMutation.isPending}
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
                          {t('devices.deviceStatus', { status: deviceStatusLabel(item.status) })}
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
                        onCopyHash={() => void copyHash(item.generatedHashKey)}
                        onToggleActive={() => void handleToggleActive(item)}
                        onReview={() => openReview(item)}
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
                        onCopyHash={() => void copyHash(item.generatedHashKey)}
                        onToggleActive={() => void handleToggleActive(item)}
                        onReview={() => openReview(item)}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 rounded-md border border-border/60 bg-muted/20 px-2.5 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-3">
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <Label htmlFor={`pin-to-top-${item.id}`} className="text-xs font-medium cursor-pointer">
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
                      onCheckedChange={(v) => void updatePinToTop(item.id, v)}
                      disabled={updatePinMutation.isPending}
                    />
                  </div>
                  <div className="flex flex-col gap-2 rounded-md border border-border/60 bg-muted/20 px-2.5 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-3">
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <Label htmlFor={`steam-card-${item.id}`} className="text-xs font-medium cursor-pointer">
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
                      onCheckedChange={(v) => void updateShowSteamNowPlaying(item.id, v)}
                      disabled={updateSteamMutation.isPending}
                    />
                  </div>
                </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {total > 0 ? (
          <div className="flex flex-col gap-2 rounded-md border border-border/50 bg-muted/20 px-3 py-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span className="min-w-0 break-words">
              {t('common.countSummary', { total })}
              {items.length > 0 ? (
                <>
                  {' '}
                  ·{' '}
                  {t('common.pageSummary', {
                    start: safePage * DEVICE_LIST_PAGE_SIZE + 1,
                    end: safePage * DEVICE_LIST_PAGE_SIZE + items.length,
                  })}
                </>
              ) : null}
            </span>
            {total > DEVICE_LIST_PAGE_SIZE ? (
              <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2 sm:flex sm:w-auto sm:items-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 w-full sm:w-auto"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={safePage <= 0}
                >
                  {t('common.previousPage')}
                </Button>
                <span className="text-center tabular-nums text-sm">
                  {safePage + 1} / {totalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 w-full sm:w-auto"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={safePage >= totalPages - 1}
                >
                  {t('common.nextPage')}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <Dialog
        open={reviewDevice !== null}
        onOpenChange={(open) => {
          if (!open) {
            setReviewDeviceId(null)
            setReviewTokenId('')
          }
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton>
          {reviewDevice ? (
            <>
              <DialogHeader>
                <DialogTitle>{t('devices.reviewTitle')}</DialogTitle>
                <DialogDescription>
                  {t('devices.reviewDescription')}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 text-sm">
                <p>
                  <span className="text-muted-foreground">{t('devices.fieldDisplayName')}</span>
                  {reviewDevice.displayName}
                </p>
                <p className="text-xs">
                  <span className="text-muted-foreground">{t('devices.fieldIdentity')}</span>
                  <span className="font-mono break-all">{reviewDevice.generatedHashKey}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">{t('devices.fieldStatus')}</span>
                  {deviceStatusLabel(reviewDevice.status)}
                </p>
                <p>
                  <span className="text-muted-foreground">{t('devices.fieldLastOnline')}</span>
                  <FormattedTime
                    date={reviewDevice.lastSeenAt}
                    pattern="yyyy-MM-dd HH:mm:ss"
                    fallback="—"
                  />
                </p>
                <p>
                  <span className="text-muted-foreground">{t('devices.fieldToken')}</span>
                  {reviewDevice.apiToken ? reviewDevice.apiToken.name : t('devices.tokenUnbound')}
                </p>
                {reviewDevice.apiToken ? (
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-xs text-amber-800 dark:text-amber-200">
                    {t('devices.bindingChangeDetected', { name: reviewDevice.apiToken.name })}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="review-device-token">{t('devices.reviewBindToken')}</Label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Select
                        value={reviewTokenId || 'none'}
                        onValueChange={(v) => setReviewTokenId(v === 'none' ? '' : v)}
                      >
                        <SelectTrigger id="review-device-token" className="flex-1">
                          <SelectValue placeholder={t('devices.selectToken')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{t('devices.unbind')}</SelectItem>
                          {tokens.map((tokenOption) => (
                            <SelectItem key={tokenOption.id} value={String(tokenOption.id)}>
                              {tokenOption.name}
                              {!tokenOption.isActive ? t('devices.disabledTokenSuffix') : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full sm:w-auto"
                        disabled={updateBindingMutation.isPending}
                        onClick={() => {
                          const parsed = reviewTokenId ? Number(reviewTokenId) : NaN
                          const nextTokenId = Number.isFinite(parsed) ? parsed : null
                          void updateBinding(reviewDevice.id, nextTokenId)
                        }}
                      >
                        {t('devices.saveBinding')}
                      </Button>
                    </div>
                    <p className="text-[11px] text-amber-600 dark:text-amber-300">
                      {t('devices.bindTokenBeforeApprove')}
                    </p>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void updateStatus(reviewDevice.id, 'revoked')}
                >
                  {t('devices.reject')}
                </Button>
                <Button
                  type="button"
                  disabled={!reviewDevice.apiToken}
                  onClick={() => void updateStatus(reviewDevice.id, 'active')}
                >
                  {t('devices.approve')}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
