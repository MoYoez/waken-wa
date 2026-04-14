import { AdminLanguageToggle } from '@/components/admin/admin-language-toggle'
import { AdminThemeRuntime } from '@/components/admin/admin-theme-runtime'
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
      <AdminThemeRuntime />
      <div className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex justify-center sm:inset-x-6 sm:bottom-6 lg:hidden">
        <div className="pointer-events-auto inline-flex items-center gap-1.5 rounded-[28px] border border-border/70 bg-background/78 px-2 py-2 shadow-[0_18px_45px_rgba(15,23,42,0.12)] backdrop-blur-xl">
          <AdminLanguageToggle className="border-transparent bg-transparent shadow-none backdrop-blur-0" />
          <div className="h-8 w-px bg-border/70" aria-hidden />
          <ThemeModeToggle className="border-transparent bg-transparent shadow-none backdrop-blur-0" />
        </div>
      </div>
      <div className="pb-24 sm:pb-28 lg:pb-0">{children}</div>
      <AdminToaster />
    </>
  )
}
