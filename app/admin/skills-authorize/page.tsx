import { redirect } from 'next/navigation'

import { SkillsOauthAuthorizeCard } from '@/components/admin/skills-oauth-authorize-card'
import { getSession } from '@/lib/auth'
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
        <h1 className="text-lg font-semibold">Skills 授权</h1>
        <p className="text-sm text-muted-foreground">
          还未启用「允许 AI 调试」。请先到后台 Web 配置 → 进阶设置中启用。
        </p>
      </div>
    )
  }
  if (String(cfg.skillsAuthMode ?? '').toLowerCase() !== 'oauth') {
    return (
      <div className="mx-auto max-w-2xl p-6 space-y-3">
        <h1 className="text-lg font-semibold">Skills 授权</h1>
        <p className="text-sm text-muted-foreground">
          当前未选择 OAuth 模式。请到后台 Web 配置 → 进阶设置中将认证模式切换为 OAuth。
        </p>
      </div>
    )
  }
  const authorizeRequest = await getSkillsOauthAuthorizeRequest(authorizeCode)
  if (!authorizeRequest) {
    return (
      <div className="mx-auto max-w-2xl p-6 space-y-3">
        <h1 className="text-lg font-semibold">Skills 授权</h1>
        <p className="text-sm text-muted-foreground">
          授权链接无效或已过期。请重新从 AI 返回的指引中打开新的授权链接。
        </p>
      </div>
    )
  }
  if (authorizeRequest.exchangeAt) {
    return (
      <div className="mx-auto max-w-2xl p-6 space-y-3">
        <h1 className="text-lg font-semibold">Skills 授权</h1>
        <p className="text-sm text-muted-foreground">
          该授权码已兑换完成。请让 AI 重新发起授权流程。
        </p>
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

