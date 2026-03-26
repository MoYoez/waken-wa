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
  
  console.log('[v0] Admin page - hasAdmin:', hasAdmin, 'hasToken:', !!token)
  
  if (!token) {
    console.log('[v0] No token found, redirecting to login')
    if (!hasAdmin) {
      redirect('/admin/setup')
    }
    redirect('/admin/login')
  }
  
  const session = await verifySession(token)
  console.log('[v0] Session verification result:', session ? 'valid' : 'invalid')
  
  if (!session) {
    if (!hasAdmin) {
      redirect('/admin/setup')
    }
    redirect('/admin/login')
  }
  
  return <AdminDashboard username={session.username} />
}
