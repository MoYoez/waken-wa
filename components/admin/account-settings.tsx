'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Shield, Trash2, User } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
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
      toast.success('管理员创建成功')
      await queryClient.invalidateQueries({ queryKey: adminQueryKeys.users.list() })
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : '网络异常，请重试')
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
      toast.success('管理员已删除')
      await queryClient.invalidateQueries({ queryKey: adminQueryKeys.users.list() })
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : '网络异常，请重试')
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
      toast.success('密码修改成功')
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : '网络异常，请重试')
    },
  })

  const createAdmin = async () => {
    if (!newAdminUsername.trim() || !newAdminPassword.trim()) {
      toast.error('用户名和密码不能为空')
      return
    }
    await createAdminMutation.mutateAsync()
  }

  const deleteAdmin = async (id: number) => {
    if (admins.length <= 1) {
      toast.error('至少需要保留一个管理员账户')
      return
    }
    await deleteAdminMutation.mutateAsync(id)
  }

  const changePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('请填写所有密码字段')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('新密码与确认密码不一致')
      return
    }
    if (newPassword.length < 6) {
      toast.error('新密码长度至少 6 位')
      return
    }
    await changePasswordMutation.mutateAsync()
  }

  if (adminsQuery.isLoading) {
    return <div className="text-sm text-muted-foreground">加载中...</div>
  }

  return (
    <div className="space-y-6">
      {/* 修改密码 */}
      <div className="rounded-xl border bg-card p-6 space-y-4">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <Shield className="h-4 w-4" />
          修改当前账户密码
        </h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>当前密码</Label>
            <Input
              type="password"
              placeholder="输入当前密码"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>新密码</Label>
            <Input
              type="password"
              placeholder="输入新密码"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>确认新密码</Label>
            <Input
              type="password"
              placeholder="再次输入新密码"
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
          {changePasswordMutation.isPending ? '修改中...' : '修改密码'}
        </Button>
      </div>

      {/* 管理员列表 */}
      <div className="rounded-xl border bg-card p-6 space-y-4">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <User className="h-4 w-4" />
          管理员账号
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
                暂无管理员
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
                    创建于 <FormattedTime date={u.createdAt} pattern="yyyy-MM-dd HH:mm:ss" />
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
                      <AlertDialogTitle>确认删除管理员</AlertDialogTitle>
                      <AlertDialogDescription>
                        确定要删除管理员「{u.username}」吗？此操作不可恢复。
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>取消</AlertDialogCancel>
                      <AlertDialogAction onClick={() => void deleteAdmin(u.id)}>
                        删除
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

      {/* 新增管理员 */}
      <div className="rounded-xl border bg-card p-6 space-y-4">
        <h3 className="font-semibold text-foreground">新增管理员</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>用户名</Label>
            <Input
              placeholder="新管理员用户名"
              value={newAdminUsername}
              onChange={(e) => setNewAdminUsername(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>密码</Label>
            <Input
              type="password"
              placeholder="新管理员密码"
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
              {createAdminMutation.isPending ? '创建中...' : '新增管理员'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
