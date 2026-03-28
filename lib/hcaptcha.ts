import prisma from '@/lib/prisma'
import type { HCaptchaConfig } from '@/types/hcaptcha'

export type { HCaptchaConfig } from '@/types/hcaptcha'

/**
 * Resolve hCaptcha keys.
 * Priority: env vars > DB SiteConfig.
 * Env vars HCAPTCHA_SITE_KEY + HCAPTCHA_SECRET_KEY override DB when both are set.
 */
function resolveHCaptchaKeys(dbConfig: Record<string, unknown> | null): {
  enabled: boolean
  siteKey: string | null
  secretKey: string | null
} {
  const envSiteKey = process.env.HCAPTCHA_SITE_KEY?.trim()
  const envSecretKey = process.env.HCAPTCHA_SECRET_KEY?.trim()
  if (envSiteKey && envSecretKey) {
    return { enabled: true, siteKey: envSiteKey, secretKey: envSecretKey }
  }

  if (!dbConfig?.hcaptchaEnabled || !dbConfig.hcaptchaSiteKey || !dbConfig.hcaptchaSecretKey) {
    return { enabled: false, siteKey: null, secretKey: null }
  }
  return {
    enabled: true,
    siteKey: dbConfig.hcaptchaSiteKey as string,
    secretKey: dbConfig.hcaptchaSecretKey as string,
  }
}

/** Public config safe to send to the client (no secret key). */
export async function getHCaptchaPublicConfig(): Promise<HCaptchaConfig> {
  const config = await (prisma as any).siteConfig.findUnique({ where: { id: 1 } })
  const resolved = resolveHCaptchaKeys(config)
  return { enabled: resolved.enabled, siteKey: resolved.siteKey }
}

/** Verify hCaptcha response token server-side. Returns true if valid or captcha is disabled. */
export async function verifyHCaptchaIfEnabled(responseToken: string | undefined): Promise<boolean> {
  const config = await (prisma as any).siteConfig.findUnique({ where: { id: 1 } })
  const resolved = resolveHCaptchaKeys(config)
  if (!resolved.enabled) return true
  if (!responseToken) return false

  try {
    const res = await fetch('https://api.hcaptcha.com/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: resolved.secretKey!,
        response: responseToken,
      }),
    })
    const data = await res.json()
    return data?.success === true
  } catch (err) {
    console.error('[hcaptcha] verification request failed:', err)
    return false
  }
}
