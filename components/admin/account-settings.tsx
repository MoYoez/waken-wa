'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Shield, Trash2, User } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useT } from 'next-i18next/client'
import { useState } from 'react'
import { toast } from 'sonner'

import {
  getAdminPanelTransition,
  getAdminSectionVariants,
} from '@/components/admin/admin-motion'
import { fetchAdminUsers } from '@/components/admin/admin-query-fetchers'
import { adminQueryKeys } from '@/components/admin/admin-query-keys'
import {
  changeAdminPassword,
  createAdminUser,
  deleteAdminUser,
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { AdminUserRow } from '@/types/admin'

export function AccountSettings() {
  const { t } = useT('admin')
  const queryClient = useQueryClient()
  const prefersReducedMotion = Boolean(useReducedMotion())
  const [newAdminUsername, setNewAdminUsername] = useState('')
  const [newAdminPassword, setNewAdminPassword] = useState('')

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const adminsQuery = useQuery({
    queryKey: adminQueryKeys.users.list(),
    queryFn: fetchAdminUsers,
  })
  const admins = adminsQuery.data ?? []
  const sectionTransition = getAdminPanelTransition(prefersReducedMotion)
  const sectionVariants = getAdminSectionVariants(prefersReducedMotion, {
    enterY: 10,
    exitY: 8,
    scale: 0.996,
  })

  const createAdminMutation = useMutation({
    mutationFn: async (): Promise<AdminUserRow> =>
      createAdminUser({
        username: newAdminUsername,
        password: newAdminPassword,
      }),
    onSuccess: async (created) => {
      setNewAdminUsername('')
      setNewAdminPassword('')
      queryClient.setQueryData<AdminUserRow[]>(adminQueryKeys.users.list(), (prev) =>
        Array.isArray(prev) ? [created, ...prev] : [created],
      )
      toast.success(t('account.createAdminSuccess'))
      await queryClient.invalidateQueries({ queryKey: adminQueryKeys.users.list() })
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t('common.networkErrorRetry'))
    },
  })

  const deleteAdminMutation = useMutation({
    mutationFn: async (id: number) => {
      await deleteAdminUser(id)
      return id
    },
    onSuccess: async (deletedId) => {
      queryClient.setQueryData<AdminUserRow[]>(adminQueryKeys.users.list(), (prev) =>
        Array.isArray(prev) ? prev.filter((user) => user.id !== deletedId) : prev,
      )
      toast.success(t('account.adminDeleted'))
      await queryClient.invalidateQueries({ queryKey: adminQueryKeys.users.list() })
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t('common.networkErrorRetry'))
    },
  })

  const changePasswordMutation = useMutation({
    mutationFn: async () =>
      changeAdminPassword({
        currentPassword,
        newPassword,
      }),
    onSuccess: () => {
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      toast.success(t('account.passwordChanged'))
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t('common.networkErrorRetry'))
    },
  })

  const createAdmin = async () => {
    if (!newAdminUsername.trim() || !newAdminPassword.trim()) {
      toast.error(t('account.usernamePasswordRequired'))
      return
    }
    await createAdminMutation.mutateAsync()
  }

  const deleteAdmin = async (id: number) => {
    if (admins.length <= 1) {
      toast.error(t('account.keepAtLeastOneAdmin'))
      return
    }
    await deleteAdminMutation.mutateAsync(id)
  }

  const changePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error(t('account.fillAllPasswordFields'))
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error(t('account.passwordConfirmMismatch'))
      return
    }
    if (newPassword.length < 6) {
      toast.error(t('account.newPasswordMinLength'))
      return
    }
    await changePasswordMutation.mutateAsync()
  }

  if (adminsQuery.isLoading) {
    return <div className="text-sm text-muted-foreground">{t('common.loading')}</div>
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-6 space-y-4">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <Shield className="h-4 w-4" />
          {t('account.changePasswordTitle')}
        </h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>{t('account.currentPassword')}</Label>
            <Input
              type="password"
              placeholder={t('account.currentPasswordPlaceholder')}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('account.newPassword')}</Label>
            <Input
              type="password"
              placeholder={t('account.newPasswordPlaceholder')}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('account.confirmNewPassword')}</Label>
            <Input
              type="password"
              placeholder={t('account.confirmNewPasswordPlaceholder')}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
        </div>
        <Button
          onClick={changePassword}
          disabled={
            changePasswordMutation.isPending ||
            !currentPassword ||
            !newPassword ||
            !confirmPassword
          }
        >
          {changePasswordMutation.isPending
            ? t('account.changingPassword')
            : t('account.changePassword')}
        </Button>
      </div>

      <div className="rounded-xl border bg-card p-6 space-y-4">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <User className="h-4 w-4" />
          {t('account.adminAccounts')}
        </h3>
        <div className="rounded-md border divide-y">
          <AnimatePresence initial={false}>
            {admins.length === 0 ? (
              <motion.p
                key="admins-empty"
                className="text-sm text-muted-foreground p-3"
                variants={sectionVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={sectionTransition}
              >
                {t('account.noAdmins')}
              </motion.p>
            ) : (
              admins.map((u) => (
                <motion.div
                  key={u.id}
                  className="flex items-center justify-between p-3"
                  variants={sectionVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={sectionTransition}
                  layout
                >
                <div>
                  <p className="text-sm font-medium text-foreground">{u.username}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('account.createdAt')}{' '}
                    <FormattedTime date={u.createdAt} pattern="yyyy-MM-dd HH:mm:ss" />
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={deleteAdminMutation.isPending || admins.length <= 1}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('account.confirmDeleteAdminTitle')}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t('account.confirmDeleteAdminDescription', { username: u.username })}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                      <AlertDialogAction onClick={() => void deleteAdmin(u.id)}>
                        {t('common.delete')}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 space-y-4">
        <h3 className="font-semibold text-foreground">{t('account.addAdminTitle')}</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>{t('account.username')}</Label>
            <Input
              placeholder={t('account.newAdminUsernamePlaceholder')}
              value={newAdminUsername}
              onChange={(e) => setNewAdminUsername(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('account.password')}</Label>
            <Input
              type="password"
              placeholder={t('account.newAdminPasswordPlaceholder')}
              value={newAdminPassword}
              onChange={(e) => setNewAdminPassword(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button
              onClick={createAdmin}
              disabled={
                createAdminMutation.isPending || !newAdminUsername || !newAdminPassword
              }
              className="w-full sm:w-auto"
            >
              {createAdminMutation.isPending ? t('account.creatingAdmin') : t('account.addAdmin')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
