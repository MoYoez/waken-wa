import type { LucideIcon } from 'lucide-react'
import {
  CalendarDays,
  Key,
  LayoutDashboard,
  Lightbulb,
  Link2Off,
  MonitorSmartphone,
  Settings,
  UserCog,
} from 'lucide-react'

import type { AdminTabValue } from '@/types/admin-dashboard'

export type AdminDashboardTabItem = {
  value: AdminTabValue
  label: string
  description: string
  icon: LucideIcon
}

export const ADMIN_DASHBOARD_TAB_ITEMS: ReadonlyArray<AdminDashboardTabItem> = [
  {
    value: 'overview',
    label: '概览',
    description: '快速处理临时操作与上报补录',
    icon: LayoutDashboard,
  },
  {
    value: 'inspiration',
    label: '灵感随想录',
    description: '管理公开内容与正文素材',
    icon: Lightbulb,
  },
  {
    value: 'schedule',
    label: '课表',
    description: '维护课程模板与首页展示逻辑',
    icon: CalendarDays,
  },
  {
    value: 'devices',
    label: '设备管理',
    description: '审核设备、切换状态与设备行为',
    icon: MonitorSmartphone,
  },
  {
    value: 'tokens',
    label: 'API Token',
    description: '管理上报凭据与接入配置',
    icon: Key,
  },
  {
    value: 'account',
    label: '账户',
    description: '修改管理员密码与账号信息',
    icon: UserCog,
  },
  {
    value: 'orphan-images',
    label: '孤儿图片',
    description: '清理未被正文引用的素材',
    icon: Link2Off,
  },
  {
    value: 'settings',
    label: '网站设置',
    description: '统一管理站点行为、主题与规则',
    icon: Settings,
  },
] as const

export const ADMIN_DASHBOARD_VALID_TABS = new Set(
  ADMIN_DASHBOARD_TAB_ITEMS.map((item) => item.value),
)

export const ADMIN_RECENT_ACTIVITY_USAGE_LIMIT = 5

export const ADMIN_SHORT_EVENT_FILTER_MS = 30_000
