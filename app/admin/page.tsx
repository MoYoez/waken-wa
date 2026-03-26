import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/auth'
import { AdminDashboard } from '@/components/admin/dashboard'
import prisma from '@/lib/prisma'

// 强制动态渲染，确保每次请求都获取最新数据
export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const hasAdmin = (await prisma.adminUser.count()) > 0
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  
  if (!token) {
    if (!hasAdmin) {
      redirect('/admin/setup')
    }
    redirect('/admin/login')
  }
  
  const session = await verifySession(token)
  
  if (!session) {
    if (!hasAdmin) {
      redirect('/admin/setup')
    }
    redirect('/admin/login')
  }
  
  return <AdminDashboard username={session.username} />
}
