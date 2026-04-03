import { redirect } from 'next/navigation'
import { Suspense } from 'react'

import { LoginForm } from '@/components/admin/login-form'
import { getHCaptchaPublicConfig } from '@/lib/hcaptcha'
import { getAdminInitState } from '@/lib/is-config-ok'

export default async function LoginPage() {
  const { hasAdmin } = await getAdminInitState()
  if (!hasAdmin) {
    redirect('/admin/setup')
  }

  const hcaptcha = await getHCaptchaPublicConfig()

  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <LoginForm hcaptchaEnabled={hcaptcha.enabled} hcaptchaSiteKey={hcaptcha.siteKey} />
    </Suspense>
  )
}
