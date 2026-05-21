import { redirect } from 'next/navigation'

import { PublicPageShell } from '@/components/public-page-shell'
import { SiteLockForm } from '@/components/site-lock-form'
import { preparePublicPageShell } from '@/lib/public-page-shell'
import packageJson from '@/package.json'

export default async function InspirationLayout({ children }: { children: React.ReactNode }) {
  const result = await preparePublicPageShell()
  switch (result.kind) {
    case 'redirect-setup':
      redirect('/admin/setup')
    case 'locked':
      return (
        <SiteLockForm
          hcaptchaEnabled={result.hcaptcha.enabled}
          hcaptchaSiteKey={result.hcaptcha.siteKey}
        />
      )
    case 'ready':
      return (
        <PublicPageShell
          scope="inspiration"
          shell={result.shell}
          appVersion={packageJson.version}
        >
          {children}
        </PublicPageShell>
      )
  }
}
