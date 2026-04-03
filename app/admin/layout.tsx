import { AdminToaster } from '@/components/admin/admin-toaster'

export const dynamic = 'force-dynamic'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      {children}
      <AdminToaster />
    </>
  )
}
