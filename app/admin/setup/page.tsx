import { redirect } from 'next/navigation'

import { SetupForm } from '@/components/admin/setup-form'
import { getAdminSetupSnapshot } from '@/lib/is-config-ok'

// Always re-check DB; do not cache a stale “still in setup” shell from build/ISR.
export const dynamic = 'force-dynamic'

export default async function AdminSetupPage() {
  const { isConfigOK, hasAdmin, initialConfig } = await getAdminSetupSnapshot()

  if (isConfigOK) {
    redirect('/admin')
  }

  return (
    <SetupForm needAdminSetup={!hasAdmin} initialConfig={initialConfig} />
  )
}
