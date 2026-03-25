'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Activity, 
  LayoutDashboard, 
  List, 
  Key, 
  LogOut,
  Monitor,
  Clock,
  TrendingUp,
  Home
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { StatsCards } from './stats-cards'
import { ActivityList } from './activity-list'
import { TokenManager } from './token-manager'
import { AddActivityForm } from './add-activity-form'

interface DashboardProps {
  username: string
}

interface Stats {
  totalActivities: number
  todayActivities: number
  totalDevices: number
  activeTokens: number
  recentDevices: Array<{ device: string; last_used: string; count: string }>
  topProcesses: Array<{ process_name: string; count: string }>
}

export function AdminDashboard({ username }: DashboardProps) {
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/stats')
      const data = await res.json()
      if (data.success) {
        setStats(data.data)
      }
    } catch {
      // 忽略
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

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
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* 统计卡片 */}
            <StatsCards stats={stats} loading={loading} />
            
            {/* 快速添加活动 */}
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-xl border bg-card p-6">
                <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  快速添加活动
                </h3>
                <AddActivityForm onSuccess={fetchStats} />
              </div>
              
              {/* 热门进程 */}
              <div className="rounded-xl border bg-card p-6">
                <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  热门进程
                </h3>
                {stats?.topProcesses && stats.topProcesses.length > 0 ? (
                  <div className="space-y-3">
                    {stats.topProcesses.map((process, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="text-sm text-foreground">{process.process_name}</span>
                        <span className="text-sm text-muted-foreground">{process.count} 次</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">暂无数据</p>
                )}
              </div>
            </div>
            
            {/* 最近设备 */}
            <div className="rounded-xl border bg-card p-6">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Monitor className="h-4 w-4" />
                活跃设备
              </h3>
              {stats?.recentDevices && stats.recentDevices.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {stats.recentDevices.map((device, i) => (
                    <div key={i} className="rounded-lg border bg-background p-4">
                      <p className="font-medium text-foreground">{device.device}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {device.count} 条活动记录
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">暂无设备数据</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="activities">
            <ActivityList />
          </TabsContent>

          <TabsContent value="tokens">
            <TokenManager />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
