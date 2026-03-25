import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/auth'
import { AdminDashboard } from '@/components/admin/dashboard'

export default async function AdminPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  
  if (!token) {
    redirect('/admin/login')
  }
  
  const session = await verifySession(token)
  
  if (!session) {
    redirect('/admin/login')
  }
  
  return <AdminDashboard username={session.username} />
}
