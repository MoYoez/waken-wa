import { AdminToaster } from '@/components/admin/admin-toaster'
import { ThemeModeToggle } from '@/components/theme-mode-toggle'

export const dynamic = 'force-dynamic'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <div className="pointer-events-none fixed right-4 top-4 z-50 sm:right-6 sm:top-6 lg:hidden">
        <div className="pointer-events-auto">
          <ThemeModeToggle />
        </div>
      </div>
      {children}
      <AdminToaster />
    </>
  )
}
