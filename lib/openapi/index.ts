import 'server-only'

import { buildComponents } from '@/lib/openapi/components'
import { buildDevicePaths } from '@/lib/openapi/paths/device'
import { buildInspirationPaths } from '@/lib/openapi/paths/inspiration'
import { buildLlmPaths } from '@/lib/openapi/paths/llm'
import { buildMcpPaths } from '@/lib/openapi/paths/mcp'
import type { OpenApiDocument } from '@/lib/openapi/types'

export function getOpenApiDocument(baseUrl: string): OpenApiDocument {
  return {
    openapi: '3.1.0',
    info: {
      title: 'Waken-Wa Life Panel API',
      version: '1.0.0',
      summary: 'Integration reference for the Waken-Wa personal life dashboard: device presence, AI tooling, and inspiration journal APIs.',
      description: [
        'Waken-Wa is a self-hosted personal life dashboard: a profile, schedule, activity, app-presence, and inspiration panel that the owner can intentionally share.',
        '',
        'In playful owner-side wording, the public page can be understood as a consent-based "soft-stalking" / "视奸" surface: visitors get a quick glance at the owner\'s current status and recent traces, while admin controls still decide what is exposed.',
        '',
        'This document covers the integration surfaces currently intended for devices, LLM clients, and inspiration journal workflows.',
        '',
        'Notes:',
        '- This reference intentionally excludes `/api/admin/*` routes.',
        '- Some documented operations still require a bearer token, admin session cookie, or a satisfied site-lock session.',
        '- `/api/llm/md` remains the AI-targeted protocol document; Scalar is the human-friendly API reference layer.',
      ].join('\n'),
    },
    servers: [{ url: baseUrl, description: 'Current request origin' }],
    externalDocs: {
      description: 'AI-oriented personal life panel protocol markdown',
      url: `${baseUrl}/api/llm/md`,
    },
    tags: [
      { name: 'Device', description: 'Device reporting and feed-reading flows for the public life panel.' },
      { name: 'LLM', description: 'Skills / HTTP-based AI integration endpoints for tuning the life panel.' },
      { name: 'MCP', description: 'MCP verification and transport fallback for AI-assisted panel tooling.' },
      { name: 'Inspiration', description: 'Inspiration journal read/write and inline asset APIs.' },
    ],
    components: buildComponents(baseUrl),
    paths: {
      ...buildDevicePaths(baseUrl),
      ...buildLlmPaths(),
      ...buildMcpPaths(),
      ...buildInspirationPaths(),
    },
  }
}
