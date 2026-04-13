import { redirect } from 'next/navigation'

import { SkillsOauthAuthorizeCard } from '@/components/admin/skills-oauth-authorize-card'
import { getSession } from '@/lib/auth'
import { getT } from '@/lib/i18n/server'
import { getSiteConfigMemoryFirst } from '@/lib/site-config-cache'
import { getSkillsOauthAuthorizeRequest } from '@/lib/skills-auth'
import type { PageSearchParams } from '@/types/next'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function SkillsAuthorizePage({
  searchParams,
}: {
  searchParams?: PageSearchParams
}) {
  const params = (await searchParams) ?? {}
  const codeParam = Array.isArray(params.code) ? params.code[0] : params.code
  const authorizeCode = String(codeParam ?? '').trim()
  const { t } = await getT('admin')
  const session = await getSession()
  if (!session) {
    const nextPath = authorizeCode
      ? `/admin/skills-authorize?code=${encodeURIComponent(authorizeCode)}`
      : '/admin/skills-authorize'
    redirect(`/admin/login?next=${encodeURIComponent(nextPath)}`)
  }

  const cfg = await getSiteConfigMemoryFirst()
  if (!cfg?.skillsDebugEnabled) {
    return (
      <div className="mx-auto max-w-2xl p-6 space-y-3">
        <h1 className="text-lg font-semibold">{t('skillsAuthorizePage.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('skillsAuthorizePage.debugDisabled')}</p>
      </div>
    )
  }
  if (String(cfg.skillsAuthMode ?? '').toLowerCase() !== 'oauth') {
    return (
      <div className="mx-auto max-w-2xl p-6 space-y-3">
        <h1 className="text-lg font-semibold">{t('skillsAuthorizePage.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('skillsAuthorizePage.oauthModeRequired')}</p>
      </div>
    )
  }
  const authorizeRequest = await getSkillsOauthAuthorizeRequest(authorizeCode)
  if (!authorizeRequest) {
    return (
      <div className="mx-auto max-w-2xl p-6 space-y-3">
        <h1 className="text-lg font-semibold">{t('skillsAuthorizePage.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('skillsAuthorizePage.invalidOrExpiredLink')}</p>
      </div>
    )
  }
  if (authorizeRequest.exchangeAt) {
    return (
      <div className="mx-auto max-w-2xl p-6 space-y-3">
        <h1 className="text-lg font-semibold">{t('skillsAuthorizePage.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('skillsAuthorizePage.codeAlreadyExchanged')}</p>
      </div>
    )
  }
  const publicOrigin =
    (process.env.PUBLIC_APP_URL?.trim() || '').replace(/\/+$/, '') || ''

  return (
    <div className="min-h-screen bg-background">
      <SkillsOauthAuthorizeCard
        publicOrigin={publicOrigin}
        aiClientId={authorizeRequest.aiClientId}
        authorizeCode={authorizeCode}
      />
    </div>
  )
}

