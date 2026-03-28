'use client'

import {
  Activity,
  CalendarDays,
  Clock,
  Home,
  Key,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  MonitorSmartphone,
  Settings,
  UserCog,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { AccountSettings } from './account-settings'
import { AddActivityForm } from './add-activity-form'
import { DeviceManager } from './device-manager'
import { InspirationManager } from './inspiration-manager'
import { ScheduleManager } from './schedule-manager'
import { TokenManager } from './token-manager'
import { WebSettings } from './web-settings'

const VALID_TABS = new Set([
  'overview',
  'inspiration',
  'devices',
  'tokens',
  'account',
  'settings',
  'schedule',
])

interface DashboardProps {
  username: string
  initialTab?: string
  initialDeviceHash?: string
}

export function AdminDashboard({ username, initialTab, initialDeviceHash }: DashboardProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState(() =>
    initialTab && VALID_TABS.has(initialTab) ? initialTab : 'overview',
  )

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/admin/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <h1 className="font-semibold text-foreground">管理后台</h1>
                <p className="text-xs text-muted-foreground">欢迎, {username}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => router.push('/')}>
                <Home className="h-4 w-4 mr-1" />
                前台
              </Button>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-1" />
                登出
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview" className="gap-2">
              <LayoutDashboard className="h-4 w-4" />
              概览
            </TabsTrigger>
            <TabsTrigger value="inspiration" className="gap-2">
              <Lightbulb className="h-4 w-4" />
              灵感随想录
            </TabsTrigger>
            <TabsTrigger value="devices" className="gap-2">
              <MonitorSmartphone className="h-4 w-4" />
              设备管理
            </TabsTrigger>
            <TabsTrigger value="tokens" className="gap-2">
              <Key className="h-4 w-4" />
              API Token
            </TabsTrigger>
            <TabsTrigger value="account" className="gap-2">
              <UserCog className="h-4 w-4" />
              账户
            </TabsTrigger>
            <TabsTrigger value="schedule" className="gap-2">
              <CalendarDays className="h-4 w-4" />
              课表
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              设置
            </TabsTrigger>

          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="rounded-xl border bg-card p-6 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  快速添加活动
                </h3>
                <Button type="button" variant="outline" size="sm" onClick={() => setActiveTab('devices')}>
                  <MonitorSmartphone className="h-4 w-4 mr-1" />
                  打开设备管理
                </Button>
              </div>
              <AddActivityForm />
            </div>
          </TabsContent>
          <TabsContent value="inspiration">
            <InspirationManager />
          </TabsContent>

          <TabsContent value="devices">
            <DeviceManager initialHashKey={initialDeviceHash} highlightHashKey={initialDeviceHash} />
          </TabsContent>

          <TabsContent value="tokens">
            <TokenManager />
          </TabsContent>

          <TabsContent value="account">
            <AccountSettings />
          </TabsContent>

          <TabsContent value="settings">
            <WebSettings />
          </TabsContent>

          <TabsContent value="schedule">
            <ScheduleManager />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
