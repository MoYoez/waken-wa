import { NextResponse } from 'next/server'

import { getSiteConfigMemoryFirst } from '@/lib/site-config-cache'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  const cfg = await getSiteConfigMemoryFirst()
  const enabled = cfg?.skillsDebugEnabled === true
  const modeRaw = String(cfg?.skillsAuthMode ?? '').trim().toLowerCase()
  const authMode = modeRaw === 'oauth' || modeRaw === 'apikey' ? modeRaw : 'unconfigured'

  const lines: string[] = []

  lines.push('---')
  lines.push('name: waken-admin-debug')
  lines.push('description: >-')
  lines.push('  Assists with site debugging and configuration changes for Waken personal site.')
  lines.push('  Use when the user asks to modify site settings, adjust theme or branding,')
  lines.push('  or manage content configuration via the Skills admin debug channel.')
  lines.push('metadata:')
  lines.push('  author: waken-wa')
  lines.push('  version: 1.0.0')
  lines.push('  category: development')
  lines.push('  tags: [site-admin, debug, configuration]')
  lines.push('---')
  lines.push('')

  lines.push('# Waken Admin Debug Skill')
  lines.push('')
  lines.push('Manage and debug site configuration for a Waken personal site through a secure Skills channel.')
  lines.push('')

  lines.push('## When to Use')
  lines.push('')
  lines.push('- The user asks you to change site settings (theme, branding, content strategy)')
  lines.push('- The user wants to debug or inspect current backend configuration')
  lines.push('- The user mentions "Skills", "admin debug", or "site config"')
  lines.push('')

  lines.push('## Entry Points')
  lines.push('')
  lines.push('| Endpoint | Purpose |')
  lines.push('|----------|---------|')
  lines.push('| `GET /api/admin/skills/md` | This skill document (static reference) |')
  lines.push('| `GET /api/admin/skills/direct?mode=...&token=...` | Runtime status check and token verification |')
  lines.push('')

  lines.push('## Current Status')
  lines.push('')
  lines.push(`- skillsEnabled: **${enabled ? 'true' : 'false'}**`)
  lines.push(`- authMode: **${authMode}**`)
  lines.push('')

  lines.push('## Required Headers')
  lines.push('')
  lines.push('All Skills-channel requests MUST include headers prefixed with `LLM-Skills-`:')
  lines.push('')
  lines.push('```')
  lines.push('LLM-Skills-Mode: oauth | apikey')
  lines.push('LLM-Skills-Token: YOUR_TOKEN')
  lines.push('LLM-Skills-AI: YOUR_UNIQUE_AI_ID')
  lines.push('LLM-Skills-Scope: feature | theme | content')
  lines.push('LLM-Skills-Request-Id: ANY_REQUEST_ID')
  lines.push('```')
  lines.push('')

  lines.push('## Step-by-Step Instructions')
  lines.push('')

  lines.push('### OAuth Flow (requires user confirmation)')
  lines.push('')
  lines.push('1. Generate an authorize link for the user: `/admin/skills-authorize?ai=YOUR_UNIQUE_AI_ID`')
  lines.push('2. The user opens the link and sees a confirmation dialog')
  lines.push('3. Only after the user clicks "Allow" will a token be issued (valid for 1 hour by default)')
  lines.push('4. The token is bound to your AI ID; multiple tokens can coexist for the same AI')
  lines.push('5. If not authorized or token expired, stop and provide the authorize link again')
  lines.push('')

  lines.push('### APIKEY Flow (no second confirmation)')
  lines.push('')
  lines.push('1. Check your own environment variable for an API key')
  lines.push('2. If missing, check backend configured status via the admin UI')
  lines.push('3. If still missing, instruct the user to configure an APIKEY first (do not proceed)')
  lines.push('4. If key is available, execute immediately without extra confirmation')
  lines.push('')

  lines.push('## Deny List')
  lines.push('')
  lines.push('The following settings must NEVER be modified through the Skills channel:')
  lines.push('')
  lines.push('| Category | Fields |')
  lines.push('|----------|--------|')
  lines.push('| Redis config | `useNoSqlAsCacheRedis`, `redisCacheTtlSeconds` |')
  lines.push('| Activity update | `activityUpdateMode`, `processStaleSeconds`, `historyWindowMinutes` |')
  lines.push('| Steam Web API key | `steamApiKey` |')
  lines.push('| Device restrictions | `autoAcceptNewDevices`, `inspirationAllowedDeviceHashes` |')
  lines.push('| Page lock | `pageLockEnabled`, `pageLockPassword` |')
  lines.push('| hCaptcha | `hcaptchaEnabled`, `hcaptchaSiteKey`, `hcaptchaSecretKey` |')
  lines.push('')

  lines.push('## If Skills Is Not Configured')
  lines.push('')
  lines.push('When the user has not enabled Skills, guide them to:')
  lines.push('')
  lines.push('1. Open the admin panel')
  lines.push('2. Navigate to **Web Settings** then **Advanced Settings**')
  lines.push('3. Enable **Allow AI to use Skills for debugging and configuration**')
  lines.push('4. Select either OAuth or APIKEY mode')
  lines.push('5. Complete the authorization or key generation process')
  lines.push('')

  lines.push('## Important Notes')
  lines.push('')
  lines.push('- Always verify token validity via the `direct` endpoint before performing changes')
  lines.push('- Include `LLM-Skills-Request-Id` for audit trail on every request')
  lines.push('- Scope your requests appropriately: `feature` for feature toggles, `theme` for visual settings, `content` for content strategy')
  lines.push('- All changes are logged and reversible through the admin panel')
  lines.push('')

  return new NextResponse(lines.join('\n'), {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
