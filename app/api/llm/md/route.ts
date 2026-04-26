import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { enforceApiRateLimit } from '@/lib/api-rate-limit'
import { getPublicOrigin } from '@/lib/public-request-url'
import { getSiteConfigMemoryFirst } from '@/lib/site-config-cache'
import type { LlmEndpoints, ToolMode } from '@/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const LLM_MD_RATE_LIMIT_MAX = 60
const LLM_MD_RATE_LIMIT_WINDOW_MS = 60_000
const BUILT_IN_THEME_PRESETS = [
  'basic',
  'midnight',
  'forest',
  'sakura',
  'obsidian',
  'ocean',
  'amber',
  'lavender',
  'mono',
  'nord',
  'customSurface',
] as const

function resolvePreferredToolMode(raw: unknown): ToolMode {
  return String(raw ?? '').trim().toLowerCase() === 'mcp' ? 'mcp' : 'skills'
}

function buildEndpoints(origin: string): LlmEndpoints {
  const llmBase = `${origin}/api/llm`
  return {
    llmBase,
    direct: `${llmBase}/direct`,
    markdown: `${llmBase}/md`,
    settings: `${llmBase}/settings`,
    appsExport: `${llmBase}/activity/apps-export`,
    oauthExchange: `${llmBase}/oauth/exchange`,
    legacyMcp: `${llmBase}/mcp`,
    legacyMcpApiKeyVerify: `${llmBase}/mcp/apikey`,
  }
}

function pushSection(lines: string[], title: string) {
  lines.push(title)
  lines.push('')
}

function pushBullets(lines: string[], items: string[]) {
  for (const item of items) {
    lines.push(`- ${item}`)
  }
  lines.push('')
}

function pushNumbered(lines: string[], items: string[]) {
  items.forEach((item, index) => {
    lines.push(`${index + 1}. ${item}`)
  })
  lines.push('')
}

function pushCodeBlock(lines: string[], content: string, lang = '') {
  lines.push(`\`\`\`${lang}`)
  lines.push(content)
  lines.push('```')
  lines.push('')
}

function pushCodeLines(lines: string[], content: string[]) {
  lines.push('```')
  lines.push(...content)
  lines.push('```')
  lines.push('')
}

function buildMarkdown(origin: string, preferredToolMode: ToolMode, endpoints: LlmEndpoints): string {
  const lines: string[] = []

  lines.push('---')
  lines.push('name: waken-wa-agent-skills')
  lines.push('description: >-')
  lines.push('  Agent execution protocol for Waken-Wa, a personal life dashboard /')
  lines.push('  presence panel that turns status, schedule, activity, and inspiration')
  lines.push('  into a gently stalkable homepage.')
  lines.push('  Read this document first, then follow the decision rules exactly.')
  lines.push('metadata:')
  lines.push('  author: waken-wa')
  lines.push('  version: 3.2.0')
  lines.push('  category: development')
  lines.push('  tags: [agent-protocol, llm-api, configuration]')
  lines.push('---')
  lines.push('')

  pushSection(lines, '# Waken-Wa Life Panel AI Protocol')
  lines.push('This document is written for AI clients. Treat Waken-Wa as a personal life dashboard: a self-hosted, intentionally shared status surface for profile, schedule, activity, app presence, inspiration entries, and site appearance.')
  lines.push('')
  lines.push('In product language, it is a personal life panel. In owner-side slang, it can be described as a "soft-stalking" or "视奸" style homepage, because approved visitors can glance at what the owner is doing without asking. Keep that tone playful, consent-based, and privacy-aware.')
  lines.push('')

  pushSection(lines, '## Absolute Base URL')
  lines.push('Use this exact origin for all runtime calls:')
  lines.push('')
  pushCodeBlock(lines, origin)

  pushSection(lines, '## Preferred Tool Mode')
  lines.push(`User-selected preferred tool mode: **${preferredToolMode}**`)
  lines.push('')
  lines.push('Important:')
  pushBullets(lines, [
    'This is a preference, not a guarantee that the mode is usable right now',
    'You must still run runtime detection before performing actions',
  ])

  pushSection(lines, '## Canonical Endpoints')
  lines.push('| Endpoint | Use |')
  lines.push('|----------|-----|')
  lines.push(`| \`GET ${endpoints.direct}\` | Required first call. Runtime detection and next-step guide |`)
  lines.push(`| \`GET ${endpoints.markdown}\` | This document |`)
  lines.push(`| \`GET ${endpoints.settings}\` | Read site settings |`)
  lines.push(`| \`PATCH ${endpoints.settings}\` | Update site settings |`)
  lines.push(`| \`GET ${endpoints.appsExport}\` | Export used activity apps |`)
  lines.push(`| \`POST ${endpoints.oauthExchange}\` | Exchange OAuth code for key (TTL from admin settings) |`)
  lines.push(`| \`${endpoints.legacyMcp}\` | Legacy MCP fallback endpoint |`)
  lines.push(`| \`POST ${endpoints.legacyMcpApiKeyVerify}\` | Verify dedicated MCP API key |`)
  lines.push('')
  lines.push('Rule:')
  pushBullets(lines, [
    'For HTTP execution, use only `/api/llm/*` endpoints',
    'Do not use old admin endpoints for AI execution',
  ])

  pushSection(lines, '## Required Decision Order')
  lines.push('Follow these steps in order:')
  lines.push('')
  pushNumbered(lines, [
    `Call \`GET ${endpoints.direct}\``,
    'Read `preferredToolMode` from the response',
    'Read `data.detectedMode` if `success === true`',
    'If `success !== true`, stop and surface the server guide to the user',
    'If preferred mode is `skills`, use Skills flow first',
    'If preferred mode is `mcp`, use MCP flow first',
    'Only use fallback when the preferred mode is unavailable and the server indicates the fallback is enabled',
  ])

  pushSection(lines, '## Runtime Rules')
  lines.push('Hard rules:')
  pushBullets(lines, [
    'Treat Skills and MCP as mutually exclusive modes',
    '`aiToolMode=skills` means HTTP Skills is the active protocol and MCP must be treated as off',
    '`aiToolMode=mcp` means MCP is the active protocol and Skills HTTP endpoints must be treated as off',
    'Never assume auth mode from memory',
    'Never assume MCP is enabled just because a URL exists',
    'Never send a full settings object when changing one or two fields',
    'Never PATCH restricted fields',
    'If any required credential is missing, stop and ask the user',
    'If you need to confirm the actual rendered visual result or a specific display effect, open the site URL directly and inspect the live page instead of guessing from settings alone',
  ])

  pushSection(lines, '## Credential Priority')
  lines.push('Use credentials in this order:')
  lines.push('')
  pushNumbered(lines, [
    'Use the current request origin shown in `Absolute Base URL`',
    'Call `direct` and read the server-returned header template',
    'Use only credentials required by the current mode',
    'If a required field is missing, stop immediately',
  ])

  pushSection(lines, '## Skills Flow')
  lines.push('Skills exposes the personal life panel through plain HTTP calls, so an AI can help adjust the owner-facing "what am I doing lately" surface without needing a browser admin session.')
  lines.push('')
  pushSection(lines, '### Required Headers')
  pushCodeLines(lines, [
    'LLM-Skills-Mode: oauth | apikey',
    'LLM-Skills-Token: YOUR_TOKEN',
    'LLM-Skills-AI: YOUR_UNIQUE_AI_ID   # required in OAuth mode, must be your own stable AI name',
    'LLM-Skills-Scope: feature | theme | content',
    'LLM-Skills-Request-Id: ANY_REQUEST_ID',
  ])
  pushBullets(lines, [
    'In OAuth mode, the AI must choose and keep using its own stable name via `LLM-Skills-AI`',
    'Do not use a shared/default/common name across multiple different AIs',
    'The same AI name must be used consistently for authorize, exchange, and business requests',
  ])

  pushSection(lines, '### OAuth Procedure')
  pushNumbered(lines, [
    `Choose your own stable AI name first, then call \`GET ${endpoints.direct}?mode=oauth&ai=YOUR_UNIQUE_AI_ID\``,
    'Read the short-lived authorize link from the response',
    'Ask the user to open and confirm that authorize link',
    `Call \`POST ${endpoints.oauthExchange}\` with headers: LLM-Skills-Mode, LLM-Skills-Token(code), LLM-Skills-AI`,
    'Read the returned key (TTL follows admin setting), then use that key as LLM-Skills-Token for business calls',
    'Use `/api/llm/settings` or `/api/llm/activity/apps-export` only after auth succeeds',
  ])
  pushBullets(lines, [
    'On Windows, prefer PowerShell examples instead of Bash multiline `curl` examples',
    'When sending non-ASCII content such as Chinese text or emoji from Windows PowerShell, explicitly send UTF-8 bytes',
  ])
  pushSection(lines, '### OAuth Exchange Example (PowerShell)')
  pushCodeBlock(
    lines,
    [
      "[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)",
      "[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)",
      '',
      "$headers = @{",
      "  'LLM-Skills-Mode' = 'oauth'",
      "  'LLM-Skills-Token' = 'YOUR_AUTHORIZE_CODE'",
      "  'LLM-Skills-AI' = 'YOUR_UNIQUE_AI_ID'",
      "}",
      '',
      "$body = [System.Text.Encoding]::UTF8.GetBytes('{}')",
      '',
      `Invoke-RestMethod -Method Post -Uri '${endpoints.oauthExchange}' -Headers $headers -ContentType 'application/json; charset=utf-8' -Body $body`,
    ].join('\n'),
    'powershell',
  )

  pushSection(lines, '### API Key Procedure')
  pushNumbered(lines, [
    `Call \`GET ${endpoints.direct}?mode=apikey\``,
    'Read the returned headers template',
    'Use `/api/llm/settings` or `/api/llm/activity/apps-export` only after auth succeeds',
  ])

  pushSection(lines, '## MCP Flow')
  lines.push('MCP exposes the same personal life panel operations as tools for clients that can mount an MCP server.')
  lines.push('')
  lines.push('Use MCP only if all conditions are true:')
  pushBullets(lines, [
    'The preferred mode is `mcp`, or Skills cannot be used',
    'The server indicates MCP is enabled',
    'A dedicated MCP API key is available',
  ])

  pushSection(lines, '### MCP Authentication')
  pushCodeLines(lines, ['Authorization: Bearer YOUR_LEGACY_MCP_APIKEY'])

  pushSection(lines, '### MCP Verification')
  pushCodeLines(lines, [
    `POST ${endpoints.legacyMcpApiKeyVerify}`,
    'Authorization: Bearer YOUR_LEGACY_MCP_APIKEY',
  ])

  pushSection(lines, '### MCP Client Example')
  pushCodeBlock(
    lines,
    ['{', '  "waken-wa-legacy-mcp": {', `    "url": "${endpoints.legacyMcp}",`, '    "headers": {', '      "Authorization": "Bearer YOUR_LEGACY_MCP_APIKEY"', '    }', '  }', '}'].join('\n'),
    'json',
  )

  pushSection(lines, '### MCP Tools')
  lines.push('Meaning:')
  pushBullets(lines, [
    'MCP is the tool-style transport for clients that can connect to an MCP server',
    'Skills is the plain HTTP API-style transport for clients that cannot use MCP tools',
    'Both transports operate on the same site configuration domain, but only one mode is active at a time',
    'If the server is currently in `mcp` mode, prefer MCP and do not keep retrying Skills HTTP endpoints',
    'If the server is currently in `skills` mode, prefer Skills HTTP and treat MCP as disabled even if an old MCP key still exists',
  ])
  pushBullets(lines, [
    '`get_site_settings`',
    '`update_site_settings`',
    '`export_activity_apps`',
  ])

  pushSection(lines, '## Read and Write Operations')
  pushSection(lines, '### Read Current Settings')
  pushCodeLines(lines, [`GET ${endpoints.settings}`])

  pushSection(lines, '### Update Settings')
  pushCodeLines(lines, [
    `PATCH ${endpoints.settings}`,
    'Content-Type: application/json; charset=utf-8',
    '',
    '{ "fieldName": "newValue" }',
  ])
  lines.push('Rule:')
  pushBullets(lines, [
    'Send only fields that must change',
    'Do not send the whole settings object',
    'In Windows PowerShell, if JSON contains Chinese text or emoji, convert the JSON string to UTF-8 bytes before sending',
  ])

  pushSection(lines, '### Export Used Apps')
  pushCodeLines(lines, [`GET ${endpoints.appsExport}`])

  pushSection(lines, '## Restricted Fields')
  lines.push('Do not modify these fields through the dedicated LLM HTTP API:')
  lines.push('')
  pushBullets(lines, [
    '`useNoSqlAsCacheRedis`',
    '`redisCacheTtlSeconds`',
    '`activityUpdateMode`',
    '`processStaleSeconds`',
    '`historyWindowMinutes`',
    '`steamApiKey`',
    '`autoAcceptNewDevices`',
    '`inspirationAllowedDeviceHashes`',
    '`pageLockEnabled`',
    '`pageLockPassword`',
    '`hcaptchaEnabled`',
    '`hcaptchaSiteKey`',
    '`hcaptchaSecretKey`',
  ])

  pushSection(lines, '## Success and Failure Rules')
  lines.push('Interpret responses strictly:')
  lines.push('')
  pushBullets(lines, [
    '`200` with `success: true` means the action succeeded',
    '`401` means missing or invalid credentials',
    '`403` means the requested mode, field, or action is not allowed',
    '`404` means the capability is not enabled',
    '`503` means the server is not configured for that capability yet',
  ])
  lines.push('When a request fails:')
  pushBullets(lines, [
    'Do not invent a workaround',
    'Do not switch modes silently',
    'Read the returned guide and show the user the real next step',
  ])

  pushSection(lines, '## Allowed Change Categories')
  pushBullets(lines, [
    'Profile and branding',
    'Theme and appearance',
    'Content display text',
    'Hitokoto configuration',
    'Activity feed rules',
    'Partial Steam settings',
  ])

  pushSection(lines, '## Configuration Field Rules')
  lines.push('Interpretation rules:')
  pushBullets(lines, [
    'If a field is omitted in PATCH, keep the existing value',
    'If a field is present, validate only that field and closely related dependent fields',
    'Unless stated otherwise, string fields should be trimmed before sending',
    'Array fields should contain only meaningful entries; remove empty strings before PATCH',
    'For rule lists, send the full intended final list for that specific field',
  ])

  pushSection(lines, '### Profile and Identity')
  pushBullets(lines, [
    '`pageTitle`: Browser title and main site title. Required, non-empty, length-limited',
    '`siteIconUrl`: Optional browser tab icon URL or image data URL. Empty/null falls back to the built-in generated icon',
    '`userName`: Public display name. Required, non-empty',
    '`userBio`: Public bio text. Required, non-empty',
    '`avatarUrl`: Avatar image URL or data URL. Required, non-empty',
    '`avatarFetchByServerEnabled`: When true and `avatarUrl` is http/https, the server proxies avatar requests instead of visitors loading the remote URL directly',
    '`userNote`: Extra short note shown on profile area',
    '`profileOnlineAccentColor`: Optional custom online accent color. Use `#RRGGBB` or empty/null to reset',
    '`profileOnlinePulseEnabled`: Enables or disables the online dot pulse effect',
  ])

  pushSection(lines, '### Theme and Appearance')
  pushBullets(lines, [
    '`themePreset`: Theme preset identifier. Use `customSurface` when editing custom theme surface fields',
    '`themeCustomSurface`: Custom theme token object. Main fields are `background`, `bodyBackground`, `animatedBg`, `primary`, `secondary`, `accent`, `online`, `foreground`, `card`, `border`, `muted`, `mutedForeground`, `homeCardOverlay`, `homeCardOverlayDark`, `homeCardInsetHighlight`, `animatedBgTint1`, `animatedBgTint2`, `animatedBgTint3`, `floatingOrbColor1`, `floatingOrbColor2`, `floatingOrbColor3`, `radius`, `hideFloatingOrbs`, `transparentAnimatedBg`, `backgroundImageMode`, `backgroundImageUrl`, `backgroundImagePool`, `backgroundRandomApiUrl`, `paletteMode`, `paletteLiveEnabled`, `paletteLiveScope`, `paletteSeedImageUrl`',
    '`customCss`: Extra sanitized custom CSS. Use only for targeted overrides, advanced selectors, or remaining display details that are not exposed as dedicated theme fields',
    '`globalMouseTiltEnabled`: Enables desktop tilt motion effect',
    '`globalMouseTiltGyroEnabled`: Enables gyro tilt on supported mobile devices',
    '`smoothScrollEnabled`: Enables Lenis-powered smooth scrolling for the public site',
    '`hideActivityMedia`: Hides media payload from public activity cards without deleting stored records',
  ])
  pushBullets(lines, [
    '`backgroundImageMode`: `manual`, `randomPool`, or `randomApi`. Controls whether customSurface uses a fixed background image, a random image pool, or a random image API source',
    '`backgroundImageUrl`: Single fixed background image URL or data URL used when `backgroundImageMode=manual`',
    '`backgroundImagePool`: Array of candidate image URLs used when `backgroundImageMode=randomPool`',
    '`backgroundRandomApiUrl`: Random image API URL used when `backgroundImageMode=randomApi`',
    '`paletteMode`: `manual`, `applyFromCurrent`, or `liveFromImage`',
    '`paletteLiveEnabled`: Enables runtime palette extraction from the active image',
    '`paletteLiveScope`: Currently `randomOnly`, meaning runtime palette sync is intended for random image sources only',
    '`paletteSeedImageUrl`: Last image URL used for manual palette extraction / regeneration',
    'When `themePreset=customSurface` and `paletteMode=liveFromImage`, the active background image may be resolved first and then used to derive runtime theme variables before the public page is shown',
  ])
  pushBullets(lines, [
    `Existing theme presets: ${BUILT_IN_THEME_PRESETS.map((preset) => `\`${preset}\``).join(', ')}`,
    '`basic` is the default built-in baseline theme',
    '`customSurface` means the AI should edit `themeCustomSurface` fields instead of expecting a preset CSS file',
    'If a very specific visual result still cannot be expressed by the exposed theme fields, use `customCss` as the fallback override layer',
  ])

  pushSection(lines, '### AI Debugging Mode')
  pushBullets(lines, [
    '`skillsDebugEnabled`: Master switch for AI debugging features. If not `true`, both Skills and MCP must be treated as unavailable',
    '`aiToolMode`: User-selected active protocol. `skills` and `mcp` are mutually exclusive',
    '`skillsAuthMode`: Current Skills authentication mode. Read-only for protocol selection; detect through `direct`',
    '`mcpThemeToolsEnabled`: Extra MCP enable switch stored in site config. MCP is usable only when both `skillsDebugEnabled === true`, `aiToolMode === "mcp"`, and `mcpThemeToolsEnabled === true`',
  ])

  pushSection(lines, '### Home Text Labels')
  pushBullets(lines, [
    '`currentlyText`: Title for the current status section',
    '`earlierText`: Title for the earlier activity / inspiration section',
    '`adminText`: Footer or admin entry label',
  ])

  pushSection(lines, '### Hitokoto Note')
  pushBullets(lines, [
    '`userNoteHitokotoEnabled`: Enables random Hitokoto text for the note area',
    '`userNoteHitokotoCategories`: Category list for Hitokoto source filtering',
    '`userNoteHitokotoEncode`: Response format preference for Hitokoto service',
  ])

  pushSection(lines, '### Activity Filtering and Cute Message Rules')
  pushBullets(lines, [
    '`appMessageRules`: Array of grouped app rules like `{ processMatch, defaultText?, titleRules }`. Top level matches `processName` by case-insensitive substring; `titleRules` match `processTitle` using `mode: "plain" | "regex"` with `{ pattern, text }`, first match wins, and `text` may use `{process}` / `{title}` placeholders',
    '`appMessageRulesShowProcessName`: If `true`, append the real process name after a matched cute rule; if `false`, show only the custom text',
    '`appFilterMode`: `blacklist` or `whitelist`',
    '`appBlacklist`: Hidden process names when filter mode is `blacklist`',
    '`appWhitelist`: Allowed process names when filter mode is `whitelist`; if empty under whitelist mode, no app activity is shown',
    '`appNameOnlyList`: Process names that should show app name only and hide window title details',
    '`captureReportedAppsEnabled`: Controls whether new reported apps are kept for history/rule suggestion/export',
    '`mediaPlaySourceBlocklist`: Lowercased `metadata.play_source` list whose media metadata should be hidden from feed output',
  ])

  pushSection(lines, '### Schedule and Time')
  pushBullets(lines, [
    '`displayTimezone`: Main timezone used for display formatting',
    '`forceDisplayTimezone`: When `true`, all user-facing absolute times and schedule day/time calculations use `displayTimezone` instead of the visitor browser timezone',
    '`scheduleSlotMinutes`: Grid slot size; valid values are 15, 30, 45, 60',
    '`schedulePeriodTemplate`: Array of teaching periods such as morning/afternoon/evening slots',
    '`scheduleGridByWeekday`: Array of 7 weekday grid definitions',
    '`scheduleCourses`: Array of course objects; period ids must stay consistent with `schedulePeriodTemplate`',
    '`scheduleIcs`: Optional ICS text import payload, nullable',
    '`scheduleInClassOnHome`: Enables the in-class banner on home',
    '`scheduleHomeShowLocation`: Shows course location in home banner',
    '`scheduleHomeShowTeacher`: Shows teacher in home banner',
    '`scheduleHomeShowNextUpcoming`: Shows the next upcoming class on home',
    '`scheduleHomeAfterClassesLabel`: Label shown after classes end',
  ])

  pushSection(lines, '### Steam and External Presence')
  pushBullets(lines, [
    '`steamEnabled`: Enables Steam presence integration',
    '`steamId`: Public Steam ID used for integration',
    '`steamApiKey`: Restricted. Do not modify through Skills HTTP',
  ])

  pushSection(lines, '### Access Control and Safety')
  pushBullets(lines, [
    '`pageLockEnabled`: Restricted. Page access lock switch',
    '`pageLockPassword`: Restricted write input only; never send unless explicitly required in admin flow',
    '`hcaptchaEnabled`: Restricted',
    '`hcaptchaSiteKey`: Restricted',
    '`hcaptchaSecretKey`: Restricted',
    '`autoAcceptNewDevices`: Restricted',
    '`inspirationAllowedDeviceHashes`: Restricted',
  ])

  pushSection(lines, '### Runtime and Storage Controls')
  pushBullets(lines, [
    '`historyWindowMinutes`: Restricted in Skills HTTP',
    '`processStaleSeconds`: Restricted in Skills HTTP',
    '`activityUpdateMode`: Restricted in Skills HTTP',
    '`useNoSqlAsCacheRedis`: Restricted in Skills HTTP',
    '`redisCacheTtlSeconds`: Restricted in Skills HTTP',
    '`activityRejectLockappSleep`: Controls rejection of lock-screen / sleep-like activity noise',
  ])

  pushSection(lines, '## MCP vs Skills Summary for New Agents')
  pushBullets(lines, [
    'Skills = direct HTTP requests to `/api/llm/*`',
    'MCP = connect a tool client to the MCP endpoint and call tools instead of raw HTTP CRUD',
    'Use Skills when the client cannot mount MCP tools or when the server is in `skills` mode',
    'Use MCP when the client supports MCP and the server is in `mcp` mode',
    'Do not explain MCP as a different product area; it is only a different transport for the same site-management capability',
    'If a new AI seems confused, restate the active mode using `direct` response rather than guessing from this document alone',
  ])

  pushSection(lines, '## Short Agent Checklist')
  lines.push('Before writing:')
  pushBullets(lines, [
    'Read this document',
    'Call `direct`',
    'Confirm current usable mode',
    'Gather only required credentials',
    'Send only minimal PATCH fields',
  ])
  lines.push('If blocked:')
  pushBullets(lines, [
    'Stop',
    'Quote the server-provided next step in your own words',
    'Ask the user to complete the missing authorization or configuration',
  ])

  return lines.join('\n')
}

export async function GET(request: NextRequest) {
  const limitedResponse = await enforceApiRateLimit(request, {
    bucket: 'llm-markdown',
    maxRequests: LLM_MD_RATE_LIMIT_MAX,
    windowMs: LLM_MD_RATE_LIMIT_WINDOW_MS,
  })
  if (limitedResponse) return limitedResponse

  const cfg = await getSiteConfigMemoryFirst()
  const origin = getPublicOrigin(request)
  const preferredToolMode = resolvePreferredToolMode(cfg?.aiToolMode)
  const endpoints = buildEndpoints(origin)

  return new NextResponse(buildMarkdown(origin, preferredToolMode, endpoints), {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
