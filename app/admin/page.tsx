import { count } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { AdminDashboard } from '@/components/admin/dashboard'
import { verifySession } from '@/lib/auth'
import { db } from '@/lib/db'
import { adminUsers } from '@/lib/drizzle-schema'

function firstString(v: string | string[] | undefined): string {
  if (typeof v === 'string') return v
  if (Array.isArray(v) && v.length > 0) return v[0] ?? ''
  return ''
}

function adminPathWithQuery(sp: Record<string, string | string[] | undefined>): string {
  const q = new URLSearchParams()
  const tab = firstString(sp.tab)
  const hash = firstString(sp.hash)
  if (tab) q.set('tab', tab)
  if (hash) q.set('hash', hash)
  const s = q.toString()
  return s ? `/admin?${s}` : '/admin'
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const [cntRow] = await db.select({ c: count() }).from(adminUsers)
  const hasAdmin = Number(cntRow?.c ?? 0) > 0
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value

  if (!token) {
    if (!hasAdmin) {
      redirect('/admin/setup')
    }
    const next = adminPathWithQuery(sp)
    redirect(`/admin/login?next=${encodeURIComponent(next)}`)
  }

  const session = await verifySession(token)

  if (!session) {
    if (!hasAdmin) {
      redirect('/admin/setup')
    }
    const next = adminPathWithQuery(sp)
    redirect(`/admin/login?next=${encodeURIComponent(next)}`)
  }

  const initialTab = firstString(sp.tab) || undefined
  const initialDeviceHash = firstString(sp.hash) || undefined

  return (
    <AdminDashboard
      username={session.username}
      initialTab={initialTab}
      initialDeviceHash={initialDeviceHash}
    />
  )
}
