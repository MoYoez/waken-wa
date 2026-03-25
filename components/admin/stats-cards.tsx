'use client'

import { Activity, Calendar, Monitor, Key } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface Stats {
  totalActivities: number
  todayActivities: number
  totalDevices: number
  activeTokens: number
}

interface StatsCardsProps {
  stats: Stats | null
  loading: boolean
}

export function StatsCards({ stats, loading }: StatsCardsProps) {
  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-4 rounded" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const cards = [
    {
      title: '总活动数',
      value: stats?.totalActivities ?? 0,
      icon: Activity,
      color: 'text-blue-500',
    },
    {
      title: '今日活动',
      value: stats?.todayActivities ?? 0,
      icon: Calendar,
      color: 'text-emerald-500',
    },
    {
      title: '设备数量',
      value: stats?.totalDevices ?? 0,
      icon: Monitor,
      color: 'text-amber-500',
    },
    {
      title: '活跃 Token',
      value: stats?.activeTokens ?? 0,
      icon: Key,
      color: 'text-rose-500',
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <card.icon className={`h-4 w-4 ${card.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{card.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
