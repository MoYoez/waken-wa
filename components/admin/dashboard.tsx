'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Activity, 
  LayoutDashboard, 
  List, 
  Key, 
  Settings,
  LogOut,
  Clock,
  Home,
  UserCog
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ActivityList } from './activity-list'
import { TokenManager } from './token-manager'
import { AddActivityForm } from './add-activity-form'
import { WebSettings } from './web-settings'
import { AccountSettings } from './account-settings'

interface DashboardProps {
  username: string
}

export function AdminDashboard({ username }: DashboardProps) {
  const router = useRouter()
  const [refreshKey, setRefreshKey] = useState(0)

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/admin/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-background">
      {/* 顶部导航 */}
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
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview" className="gap-2">
              <LayoutDashboard className="h-4 w-4" />
              概览
            </TabsTrigger>
            <TabsTrigger value="activities" className="gap-2">
              <List className="h-4 w-4" />
              活动日志
            </TabsTrigger>
            <TabsTrigger value="tokens" className="gap-2">
              <Key className="h-4 w-4" />
              API Token
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              设置
            </TabsTrigger>
            <TabsTrigger value="account" className="gap-2">
              <UserCog className="h-4 w-4" />
              账户
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="rounded-xl border bg-card p-6">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                快速添加活动
              </h3>
              <AddActivityForm onSuccess={() => setRefreshKey((k) => k + 1)} />
            </div>
          </TabsContent>

          <TabsContent value="activities">
            <ActivityList key={refreshKey} />
          </TabsContent>

          <TabsContent value="tokens">
            <TokenManager />
          </TabsContent>

          <TabsContent value="settings">
            <WebSettings />
          </TabsContent>

          <TabsContent value="account">
            <AccountSettings />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
