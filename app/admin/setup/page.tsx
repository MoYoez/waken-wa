import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { SetupForm } from '@/components/admin/setup-form'

export default async function AdminSetupPage() {
  const hasAdmin = (await prisma.adminUser.count()) > 0
  const config = await (prisma as any).siteConfig.findUnique({ where: { id: 1 } })
  const hasConfig = config !== null

  if (hasAdmin && hasConfig) {
    redirect('/admin/login')
  }

  return (
    <SetupForm
      needAdminSetup={!hasAdmin}
      initialConfig={
        config
          ? {
              userName: config.userName,
              userBio: config.userBio,
              avatarUrl: config.avatarUrl,
              userNote: config.userNote,
              historyWindowMinutes: config.historyWindowMinutes,
              currentlyText: config.currentlyText,
              earlierText: config.earlierText,
              updatesText: config.updatesText,
              adminText: config.adminText,
            }
          : undefined
      }
    />
  )
}
