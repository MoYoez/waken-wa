import { z } from 'zod'
import { createMcpHandler, experimental_withMcpAuth } from 'mcp-handler'
import { NextRequest } from 'next/server'

import { enforceApiRateLimit } from '@/lib/api-rate-limit'
import { exportActivityAppsSnapshot } from '@/lib/activity-app-export'
import { getSafeSiteConfig, updateSiteConfigFromPayload } from '@/lib/llm-site-config'
import { isLegacyMcpEnabled, verifyLegacyMcpApiKey } from '@/lib/skills-auth'

const mcpHandler = createMcpHandler(
  (server) => {
    server.registerTool(
      'get_site_settings',
      {
        title: 'Get Site Settings',
        description: 'Read the current Waken site settings through the legacy MCP fallback.',
        inputSchema: {},
      },
      async () => ({
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                data: await getSafeSiteConfig(),
              },
              null,
              2,
            ),
          },
        ],
      }),
    )

    server.registerTool(
      'update_site_settings',
      {
        title: 'Update Site Settings',
        description: 'Update the current Waken site settings through the legacy MCP fallback.',
        inputSchema: {
          payload: z.record(z.string(), z.unknown()),
        },
      },
      async ({ payload }) => ({
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                data: await updateSiteConfigFromPayload(payload),
              },
              null,
              2,
            ),
          },
        ],
      }),
    )

    server.registerTool(
      'export_activity_apps',
      {
        title: 'Export Activity Apps',
        description: 'Export current activity app groups through the legacy MCP fallback.',
        inputSchema: {},
      },
      async () => ({
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                data: await exportActivityAppsSnapshot(),
              },
              null,
              2,
            ),
          },
        ],
      }),
    )
  },
  {
    serverInfo: {
      name: 'waken-wa-legacy-mcp',
      version: '1.0.0',
    },
  },
  {
    basePath: '/api/llm',
    disableSse: true,
  },
)

const authedHandler = experimental_withMcpAuth(
  mcpHandler,
  async (_req, bearerToken) => {
    if (!bearerToken) return undefined
    const enabled = await isLegacyMcpEnabled()
    if (!enabled) return undefined
    const ok = await verifyLegacyMcpApiKey(bearerToken)
    if (!ok) return undefined
    return {
      token: bearerToken,
      clientId: 'legacy-mcp-client',
      scopes: [],
    } as any
  },
  { required: true },
)

const LLM_MCP_TRANSPORT_RATE_LIMIT_MAX = 60
const LLM_MCP_TRANSPORT_RATE_LIMIT_WINDOW_MS = 60_000

async function withRateLimit(request: Request) {
  const nextRequest = request instanceof NextRequest ? request : new NextRequest(request)
  const limitedResponse = await enforceApiRateLimit(nextRequest, {
    bucket: 'llm-mcp-transport',
    maxRequests: LLM_MCP_TRANSPORT_RATE_LIMIT_MAX,
    windowMs: LLM_MCP_TRANSPORT_RATE_LIMIT_WINDOW_MS,
  })
  if (limitedResponse) return limitedResponse
  return authedHandler(request)
}

export const GET = withRateLimit
export const POST = withRateLimit
