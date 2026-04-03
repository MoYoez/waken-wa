import { redirect } from 'next/navigation'

import { SetupForm } from '@/components/admin/setup-form'
import { getSession } from '@/lib/auth'
import { getAdminSetupSnapshot } from '@/lib/is-config-ok'

export default async function AdminSetupPage() {
  const { isConfigOK, hasAdmin, initialConfig } = await getAdminSetupSnapshot()

  if (isConfigOK) {
    redirect('/admin')
  }

  if (hasAdmin) {
    const session = await getSession()
    if (!session) {
      redirect(`/admin/login?next=${encodeURIComponent('/admin/setup')}`)
    }
  }

  return (
    <SetupForm needAdminSetup={!hasAdmin} initialConfig={initialConfig} />
  )
}
