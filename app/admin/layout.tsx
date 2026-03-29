import { AdminToaster } from '@/components/admin/admin-toaster'

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
