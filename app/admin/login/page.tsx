import { count } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'

import { LoginForm } from '@/components/admin/login-form'
import { db } from '@/lib/db'
import { adminUsers } from '@/lib/drizzle-schema'
import { getHCaptchaPublicConfig } from '@/lib/hcaptcha'

export default async function LoginPage() {
  const [cntRow] = await db.select({ c: count() }).from(adminUsers)
  const hasAdmin = Number(cntRow?.c ?? 0) > 0
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
