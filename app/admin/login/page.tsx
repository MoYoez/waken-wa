import { redirect } from 'next/navigation'
import { Suspense } from 'react'

import { LoginForm } from '@/components/admin/login-form'
import { getHCaptchaPublicConfig } from '@/lib/hcaptcha'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  const hasAdmin = (await prisma.adminUser.count()) > 0
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
