'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { User, Shield, Trash2 } from 'lucide-react'

interface AdminUser {
  id: number
  username: string
  createdAt: string
}

export function AccountSettings() {
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string>('')
  const [admins, setAdmins] = useState<AdminUser[]>([])
  const [newAdminUsername, setNewAdminUsername] = useState('')
  const [newAdminPassword, setNewAdminPassword] = useState('')
  const [creatingAdmin, setCreatingAdmin] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  // 修改密码
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/admin/users')
        const data = await res.json()
        if (data?.success) setAdmins(data.data || [])
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  const createAdmin = async () => {
    setMessage('')
    if (!newAdminUsername.trim() || !newAdminPassword.trim()) {
      setMessage('用户名和密码不能为空')
      return
    }
    setCreatingAdmin(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newAdminUsername,
          password: newAdminPassword,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data?.success) {
        setMessage(data?.error || '创建管理员失败')
        return
      }
      setNewAdminUsername('')
      setNewAdminPassword('')
      setAdmins((prev) => [data.data, ...prev])
      setMessage('管理员创建成功')
    } catch {
      setMessage('网络异常，请重试')
    } finally {
      setCreatingAdmin(false)
    }
  }

  const deleteAdmin = async (id: number) => {
    if (admins.length <= 1) {
      setMessage('至少需要保留一个管理员账户')
      return
    }
    if (!confirm('确定删除该管理员？此操作不可恢复。')) return
    setDeletingId(id)
    setMessage('')
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok || !data?.success) {
        setMessage(data?.error || '删除失败')
        return
      }
      setAdmins((prev) => prev.filter((u) => u.id !== id))
      setMessage('管理员已删除')
    } catch {
      setMessage('网络异常，请重试')
    } finally {
      setDeletingId(null)
    }
  }

  const changePassword = async () => {
    setMessage('')
    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessage('请填写所有密码字段')
      return
    }
    if (newPassword !== confirmPassword) {
      setMessage('新密码与确认密码不一致')
      return
    }
    if (newPassword.length < 6) {
      setMessage('新密码长度至少 6 位')
      return
    }
    setChangingPassword(true)
    try {
      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data?.success) {
        setMessage(data?.error || '密码修改失败')
        return
      }
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setMessage('密码修改成功')
    } catch {
      setMessage('网络异常，请重试')
    } finally {
      setChangingPassword(false)
    }
  }

  if (loading) {
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
          disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
        >
          {changingPassword ? '修改中...' : '修改密码'}
        </Button>
      </div>

      {/* 管理员列表 */}
      <div className="rounded-xl border bg-card p-6 space-y-4">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <User className="h-4 w-4" />
          管理员账号
        </h3>
        <div className="rounded-md border divide-y">
          {admins.length === 0 ? (
            <p className="text-sm text-muted-foreground p-3">暂无管理员</p>
          ) : (
            admins.map((u) => (
              <div key={u.id} className="flex items-center justify-between p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{u.username}</p>
                  <p className="text-xs text-muted-foreground">
                    创建于 {new Date(u.createdAt).toLocaleString('zh-CN')}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={deletingId === u.id || admins.length <= 1}
                  onClick={() => deleteAdmin(u.id)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
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
              disabled={creatingAdmin || !newAdminUsername || !newAdminPassword}
              className="w-full sm:w-auto"
            >
              {creatingAdmin ? '创建中...' : '新增管理员'}
            </Button>
          </div>
        </div>
      </div>

      {message && (
        <p className={`text-sm ${message.includes('成功') ? 'text-green-600' : 'text-destructive'}`}>
          {message}
        </p>
      )}
    </div>
  )
}
