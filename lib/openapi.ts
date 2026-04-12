import 'server-only'

type JsonSchema = Record<string, unknown>
type OpenApiDocument = Record<string, unknown>

function jsonContent(schema: JsonSchema, examples?: Record<string, unknown>) {
  return {
    'application/json': {
      schema,
      ...(examples ? { examples } : {}),
    },
  }
}

function response(description: string, schema: JsonSchema, examples?: Record<string, unknown>) {
  return {
    description,
    content: jsonContent(schema, examples),
  }
}

function headerParameter(name: string, description: string, required = false, example?: string) {
  return {
    name,
    in: 'header',
    required,
    description,
    schema: { type: 'string' },
    ...(example ? { example } : {}),
  }
}

function queryParameter(
  name: string,
  description: string,
  required = false,
  schema: JsonSchema = { type: 'string' },
) {
  return {
    name,
    in: 'query',
    required,
    description,
    schema,
  }
}

function bearerSecurity(description: string) {
  return [{ bearerAuth: [], _note: description }]
}

function skillsHeaderSecurity(description: string) {
  return [{ skillsModeHeader: [], skillsTokenHeader: [], _note: description }]
}

function cookieOrBearerSecurity(description: string) {
  return [
    { sessionCookie: [], _note: description },
    { bearerAuth: [], _note: description },
  ]
}

function buildComponents(baseUrl: string) {
  const successEnvelope = {
    type: 'object',
    required: ['success'],
    properties: {
      success: { type: 'boolean', enum: [true] },
    },
  }

  const errorEnvelope = {
    type: 'object',
    required: ['success', 'error'],
    properties: {
      success: { type: 'boolean', enum: [false] },
      error: { type: 'string' },
    },
  }

  const activityEntry = {
    type: 'object',
    required: ['device', 'processName'],
    properties: {
      id: { oneOf: [{ type: 'number' }, { type: 'string' }] },
      device: { type: 'string' },
      processName: { type: 'string' },
      processTitle: { type: ['string', 'null'] },
      statusText: { type: ['string', 'null'] },
      generatedHashKey: { type: ['string', 'null'] },
      metadata: { type: ['object', 'null'], additionalProperties: true },
      startedAt: { type: ['string', 'null'], format: 'date-time' },
      updatedAt: { type: ['string', 'null'], format: 'date-time' },
      expiresAt: { type: ['string', 'null'], format: 'date-time' },
      deviceId: { type: ['number', 'null'] },
    },
    additionalProperties: true,
  }

  const siteConfig = {
    type: ['object', 'null'],
    description:
      'Redacted site settings payload returned by the LLM API. Restricted or secret values are omitted or masked.',
    additionalProperties: true,
    properties: {
      pageTitle: { type: 'string' },
      userName: { type: 'string' },
      userBio: { type: 'string' },
      avatarUrl: { type: 'string' },
      avatarFetchByServerEnabled: { type: 'boolean' },
      themePreset: { type: 'string' },
      aiToolMode: { type: 'string', enum: ['skills', 'mcp'] },
      skillsAuthMode: { type: ['string', 'null'], enum: ['oauth', 'apikey', null] },
      currentlyText: { type: 'string' },
      earlierText: { type: 'string' },
      adminText: { type: 'string' },
      customCss: { type: ['string', 'null'] },
      themeCustomSurface: { type: ['object', 'null'], additionalProperties: true },
      captureReportedAppsEnabled: { type: 'boolean' },
      mediaPlaySourceBlocklist: { type: 'array', items: { type: 'string' } },
      displayTimezone: { type: 'string' },
      forceDisplayTimezone: { type: 'boolean' },
    },
  }

  const inspirationEntry = {
    type: 'object',
    required: ['id', 'content', 'createdAt'],
    properties: {
      id: { type: 'integer' },
      title: { type: ['string', 'null'] },
      content: { type: 'string' },
      contentLexical: { type: ['string', 'null'] },
      imageDataUrl: { type: ['string', 'null'] },
      statusSnapshot: { type: ['string', 'null'] },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: ['string', 'null'], format: 'date-time' },
    },
  }

  return {
    schemas: {
      SuccessEnvelope: successEnvelope,
      ErrorEnvelope: errorEnvelope,
      ActivityMetadata: {
        type: 'object',
        description:
          'Custom activity metadata. The server also stores normalized fields such as deviceType, pushMode, and media.',
        additionalProperties: true,
        properties: {
          play_source: { type: 'string' },
          media: {
            type: 'object',
            additionalProperties: true,
            properties: {
              title: { type: 'string' },
              singer: { type: 'string' },
            },
          },
        },
      },
      ActivityInput: {
        type: 'object',
        required: ['generatedHashKey', 'process_name'],
        properties: {
          generatedHashKey: { type: 'string' },
          device: { type: 'string' },
          device_type: { type: 'string', enum: ['desktop', 'tablet', 'mobile'] },
          process_name: { type: 'string' },
          process_title: { type: 'string' },
          battery_level: { type: 'integer', minimum: 0, maximum: 100 },
          is_charging: { type: 'boolean' },
          isCharging: { type: 'boolean' },
          push_mode: { type: 'string', enum: ['realtime', 'active'] },
          metadata: { $ref: '#/components/schemas/ActivityMetadata' },
        },
      },
      ActivityEntry: activityEntry,
      ActivityFeed: {
        type: 'object',
        properties: {
          activeStatuses: { type: 'array', items: { $ref: '#/components/schemas/ActivityEntry' } },
          recentActivities: { type: 'array', items: { $ref: '#/components/schemas/ActivityEntry' } },
          recentTopApps: { type: 'array', items: { $ref: '#/components/schemas/ActivityEntry' } },
        },
        additionalProperties: true,
      },
      ActivityPending: {
        allOf: [
          { $ref: '#/components/schemas/ErrorEnvelope' },
          {
            type: 'object',
            properties: {
              pending: { type: 'boolean', enum: [true] },
              approvalUrl: { type: 'string', format: 'uri' },
              registration: {
                type: 'object',
                properties: {
                  displayName: { type: 'string' },
                  generatedHashKey: { type: 'string' },
                  status: { type: 'string', enum: ['pending'] },
                },
                required: ['displayName', 'generatedHashKey', 'status'],
              },
            },
          },
        ],
      },
      LlmEndpoints: {
        type: 'object',
        required: ['llmBase', 'direct', 'markdown', 'settings', 'appsExport', 'oauthExchange', 'legacyMcp', 'legacyMcpApiKeyVerify'],
        properties: {
          llmBase: { type: 'string', format: 'uri' },
          direct: { type: 'string', format: 'uri' },
          markdown: { type: 'string', format: 'uri' },
          settings: { type: 'string', format: 'uri' },
          appsExport: { type: 'string', format: 'uri' },
          oauthExchange: { type: 'string', format: 'uri' },
          legacyMcp: { type: 'string', format: 'uri' },
          legacyMcpApiKeyVerify: { type: 'string', format: 'uri' },
        },
      },
      LlmDirectSuccess: {
        allOf: [
          { $ref: '#/components/schemas/SuccessEnvelope' },
          {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  finalUrl: { type: 'string', format: 'uri' },
                  preferredToolMode: { type: 'string', enum: ['skills', 'mcp'] },
                  detectedMode: { type: 'string', enum: ['oauth', 'apikey'] },
                  endpoints: { $ref: '#/components/schemas/LlmEndpoints' },
                  headerPrefix: { type: 'string' },
                  headers: { type: 'object', additionalProperties: { type: 'string' } },
                  capabilities: { type: 'object', additionalProperties: { type: 'boolean' } },
                  guide: { type: 'object', additionalProperties: true },
                  legacyMcp: { type: 'object', additionalProperties: true },
                },
                required: ['finalUrl', 'preferredToolMode', 'endpoints'],
              },
            },
          },
        ],
      },
      LlmDirectFailure: {
        allOf: [
          { $ref: '#/components/schemas/ErrorEnvelope' },
          {
            type: 'object',
            properties: {
              finalUrl: { type: 'string', format: 'uri' },
              preferredToolMode: { type: 'string', enum: ['skills', 'mcp'] },
              endpoints: { $ref: '#/components/schemas/LlmEndpoints' },
              data: { type: 'object', additionalProperties: true },
              guide: { type: 'object', additionalProperties: true },
            },
          },
        ],
      },
      SiteConfig: siteConfig,
      SiteConfigPatch: {
        type: 'object',
        description: 'Send only the minimal fields that should change. Restricted fields are rejected by the route.',
        additionalProperties: true,
        properties: {
          pageTitle: { type: 'string' },
          userName: { type: 'string' },
          userBio: { type: 'string' },
          avatarUrl: { type: 'string' },
          avatarFetchByServerEnabled: { type: 'boolean' },
          userNote: { type: 'string' },
          themePreset: { type: 'string' },
          themeCustomSurface: { type: 'object', additionalProperties: true },
          customCss: { type: 'string' },
          currentlyText: { type: 'string' },
          earlierText: { type: 'string' },
          adminText: { type: 'string' },
          appBlacklist: { type: 'array', items: { type: 'string' } },
          appWhitelist: { type: 'array', items: { type: 'string' } },
          appNameOnlyList: { type: 'array', items: { type: 'string' } },
          mediaPlaySourceBlocklist: { type: 'array', items: { type: 'string' } },
          displayTimezone: { type: 'string' },
          forceDisplayTimezone: { type: 'boolean' },
          steamEnabled: { type: 'boolean' },
          steamId: { type: ['string', 'null'] },
          activityRejectLockappSleep: { type: 'boolean' },
        },
      },
      ExportedApp: {
        type: 'object',
        required: ['appName', 'titles', 'lastSeenAt'],
        properties: {
          appName: { type: 'string' },
          titles: { type: 'array', items: { type: 'string' } },
          lastSeenAt: { type: 'string', format: 'date-time' },
        },
      },
      AppsExport: {
        type: 'object',
        required: ['version', 'exportedAt', 'groups'],
        properties: {
          version: { type: 'integer' },
          exportedAt: { type: 'string', format: 'date-time' },
          groups: {
            type: 'object',
            properties: {
              pc: { type: 'array', items: { $ref: '#/components/schemas/ExportedApp' } },
              mobile: { type: 'array', items: { $ref: '#/components/schemas/ExportedApp' } },
            },
          },
        },
      },
      OauthExchange: {
        allOf: [
          { $ref: '#/components/schemas/SuccessEnvelope' },
          {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                required: ['token', 'aiClientId', 'expiresAt', 'oauthTokenTtlMinutes', 'headerPrefix', 'headers'],
                properties: {
                  token: { type: 'string' },
                  aiClientId: { type: 'string' },
                  expiresAt: { type: 'string', format: 'date-time' },
                  oauthTokenTtlMinutes: { type: 'integer' },
                  headerPrefix: { type: 'string' },
                  headers: { type: 'object', additionalProperties: { type: 'string' } },
                },
              },
            },
          },
        ],
      },
      InspirationEntry: inspirationEntry,
      InspirationEntriesList: {
        allOf: [
          { $ref: '#/components/schemas/SuccessEnvelope' },
          {
            type: 'object',
            properties: {
              data: { type: 'array', items: { $ref: '#/components/schemas/InspirationEntry' } },
              displayTimezone: { type: 'string' },
              pagination: {
                type: 'object',
                required: ['limit', 'offset', 'total'],
                properties: {
                  limit: { type: 'integer' },
                  offset: { type: 'integer' },
                  total: { type: 'integer' },
                },
              },
            },
          },
        ],
      },
      InspirationEntryCreate: {
        type: 'object',
        description:
          'Provide Markdown/plain content, Lexical content, or both. Device-token writes may be gated by the inspiration device allowlist.',
        properties: {
          title: { type: 'string' },
          heading: { type: 'string' },
          content: { type: 'string' },
          text: { type: 'string' },
          body: { type: 'string' },
          contentLexical: { oneOf: [{ type: 'string' }, { type: 'object', additionalProperties: true }] },
          content_lexical: { oneOf: [{ type: 'string' }, { type: 'object', additionalProperties: true }] },
          imageDataUrl: { type: 'string' },
          image_data_url: { type: 'string' },
          attachCurrentStatus: { type: 'boolean' },
          preComputedStatusSnapshot: { type: 'string' },
          pre_computed_status_snapshot: { type: 'string' },
          attachStatusDeviceHash: { type: 'string' },
          attach_status_device_hash: { type: 'string' },
          attachStatusActivityKey: { type: 'string' },
          attach_status_activity_key: { type: 'string' },
          attachStatusIncludeDeviceInfo: { type: 'boolean' },
          attach_status_include_device_info: { type: 'boolean' },
          attachStatusDeviceHashes: { type: 'array', items: { type: 'string' } },
        },
      },
      InspirationAssetCreate: {
        type: 'object',
        required: ['imageDataUrl'],
        properties: {
          imageDataUrl: { type: 'string' },
          dataUrl: { type: 'string' },
        },
      },
      InspirationAssetCreateSuccess: {
        allOf: [
          { $ref: '#/components/schemas/SuccessEnvelope' },
          {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                required: ['publicKey', 'url'],
                properties: {
                  publicKey: { type: 'string', format: 'uuid' },
                  url: {
                    type: 'string',
                    format: 'uri',
                    example: `${baseUrl}/api/inspiration/img/00000000-0000-0000-0000-000000000000`,
                  },
                },
              },
            },
          },
        ],
      },
    },
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'token',
        description:
          'Used by device reporting, inspiration write APIs through API token auth, and legacy MCP key verification.',
      },
      skillsModeHeader: {
        type: 'apiKey',
        in: 'header',
        name: 'LLM-Skills-Mode',
        description: 'Skills auth mode. The server validates oauth vs apikey at runtime.',
      },
      skillsTokenHeader: {
        type: 'apiKey',
        in: 'header',
        name: 'LLM-Skills-Token',
        description: 'OAuth token, OAuth authorize code, or API key depending on the endpoint.',
      },
      sessionCookie: {
        type: 'apiKey',
        in: 'cookie',
        name: 'session',
        description: 'Admin session cookie used by browser-based admin flows.',
      },
    },
    parameters: {
      LlmSkillsAi: headerParameter(
        'LLM-Skills-AI',
        'Stable AI identifier. Required for OAuth-based Skills flows and must stay consistent across authorize, exchange, and business calls.',
        false,
        'my-stable-ai-name',
      ),
      LlmSkillsScope: headerParameter(
        'LLM-Skills-Scope',
        'Optional logical scope such as theme, feature, or content.',
        false,
        'theme',
      ),
      LlmSkillsRequestId: headerParameter(
        'LLM-Skills-Request-Id',
        'Optional request correlation header.',
        false,
        'req-12345',
      ),
      LlmMcpKey: headerParameter(
        'X-Waken-MCP-Key',
        'Alternative legacy MCP API key header accepted by /api/llm/mcp/apikey.',
      ),
      Limit: queryParameter(
        'limit',
        'Pagination size.',
        false,
        { type: 'integer', minimum: 1, maximum: 200, default: 20 },
      ),
      Offset: queryParameter(
        'offset',
        'Pagination offset.',
        false,
        { type: 'integer', minimum: 0, default: 0 },
      ),
      Search: queryParameter('q', 'Case-insensitive text search across title/content/status snapshot.'),
      InspirationId: queryParameter(
        'id',
        'Inspiration entry id used by DELETE /api/inspiration/entries.',
        true,
        { type: 'integer', minimum: 1 },
      ),
      ActivityPublic: queryParameter(
        'public',
        'When set to 1 and the site lock has already been satisfied, returns the public activity feed.',
        false,
        { type: 'string', enum: ['1'] },
      ),
      LlmMode: queryParameter(
        'mode',
        'Optional discovery hint. Use oauth or apikey when calling /api/llm/direct.',
        false,
        { type: 'string', enum: ['oauth', 'apikey'] },
      ),
      LlmAi: queryParameter(
        'ai',
        'Optional AI identifier query alias used by the direct endpoint.',
        false,
        { type: 'string' },
      ),
      InspirationPublicKey: {
        name: 'publicKey',
        in: 'path',
        required: true,
        description: 'UUID-style public key returned by POST /api/inspiration/assets.',
        schema: { type: 'string', format: 'uuid' },
      },
      McpTransport: {
        name: 'transport',
        in: 'path',
        required: true,
        description: 'Legacy MCP transport segment handled by mcp-handler.',
        schema: { type: 'string' },
      },
    },
  }
}

export function getOpenApiDocument(baseUrl: string): OpenApiDocument {
  return {
    openapi: '3.1.0',
    info: {
      title: 'Waken External API',
      version: '1.0.0',
      summary: 'Public integration reference for device reporting, AI tooling, and inspiration journal APIs.',
      description: [
        'This document covers the public integration surfaces currently intended for devices, LLM clients, and inspiration journal workflows.',
        '',
        'Notes:',
        '- This reference intentionally excludes `/api/admin/*` routes.',
        '- Some documented operations still require a bearer token, admin session cookie, or a satisfied site-lock session.',
        '- `/api/llm/md` remains the AI-targeted protocol document; Scalar is the human-friendly API reference layer.',
      ].join('\n'),
    },
    servers: [{ url: baseUrl, description: 'Current request origin' }],
    externalDocs: {
      description: 'AI-oriented protocol markdown',
      url: `${baseUrl}/api/llm/md`,
    },
    tags: [
      { name: 'Device', description: 'Device reporting and optional feed-reading flows.' },
      { name: 'LLM', description: 'Skills / HTTP-based AI integration endpoints.' },
      { name: 'MCP', description: 'Legacy MCP verification and transport fallback.' },
      { name: 'Inspiration', description: 'Inspiration journal read/write and inline asset APIs.' },
    ],
    components: buildComponents(baseUrl),
    paths: {
      '/api/activity': {
        get: {
          tags: ['Device'],
          summary: 'Read current activity feed',
          description:
            'Supports two access modes: admin session cookie, or `?public=1` after the site lock has already been satisfied.',
          parameters: [{ $ref: '#/components/parameters/ActivityPublic' }],
          responses: {
            '200': response('Activity feed payload.', {
              allOf: [
                { $ref: '#/components/schemas/SuccessEnvelope' },
                { type: 'object', properties: { data: { $ref: '#/components/schemas/ActivityFeed' } } },
              ],
            }),
            '401': response('Missing admin session in non-public mode.', {
              $ref: '#/components/schemas/ErrorEnvelope',
            }),
            '403': response('Site lock has not been satisfied in public mode.', {
              $ref: '#/components/schemas/ErrorEnvelope',
            }),
            '500': response('Unexpected server error.', {
              $ref: '#/components/schemas/ErrorEnvelope',
            }),
          },
        },
        post: {
          tags: ['Device'],
          summary: 'Report device activity',
          description:
            'Primary device reporting endpoint. Use a bearer API token and a stable generatedHashKey.',
          security: bearerSecurity('Bearer token from the API Token admin page.'),
          requestBody: {
            required: true,
            content: jsonContent(
              { $ref: '#/components/schemas/ActivityInput' },
              {
                realtime: {
                  summary: 'Realtime report',
                  value: {
                    generatedHashKey: 'MY_DEVICE_HASH',
                    device: 'MacBook Pro',
                    device_type: 'desktop',
                    process_name: 'VS Code',
                    process_title: 'editing setup-form.tsx',
                    battery_level: 82,
                    is_charging: true,
                    push_mode: 'realtime',
                    metadata: {
                      source: 'manual-test',
                      media: { title: 'Example Track', singer: 'Example Artist' },
                    },
                  },
                },
                active: {
                  summary: 'Persistent active report',
                  value: {
                    generatedHashKey: 'MY_DEVICE_HASH',
                    device: 'Windows Desktop',
                    process_name: 'Chrome',
                    process_title: 'Dashboard',
                    push_mode: 'active',
                    metadata: { play_source: 'system_media' },
                  },
                },
              },
            ),
          },
          responses: {
            '200': response(
              'Report accepted and current activity updated.',
              {
                allOf: [
                  { $ref: '#/components/schemas/SuccessEnvelope' },
                  { type: 'object', properties: { data: { $ref: '#/components/schemas/ActivityEntry' } } },
                ],
              },
              {
                success: {
                  value: {
                    success: true,
                    data: {
                      device: 'MacBook Pro',
                      processName: 'VS Code',
                      processTitle: 'editing setup-form.tsx',
                      metadata: {
                        pushMode: 'realtime',
                        media: { title: 'Example Track', singer: 'Example Artist' },
                      },
                    },
                  },
                },
              },
            ),
            '202': response(
              'Device was registered but is waiting for manual approval.',
              { $ref: '#/components/schemas/ActivityPending' },
              {
                pending: {
                  value: {
                    success: false,
                    error: '设备待后台审核后可用',
                    pending: true,
                    approvalUrl: `${baseUrl}/admin?tab=devices&hash=MY_DEVICE_HASH`,
                    registration: {
                      displayName: 'Unknown Device',
                      generatedHashKey: 'MY_DEVICE_HASH',
                      status: 'pending',
                    },
                  },
                },
              },
            ),
            '400': response('Body was invalid or missing required fields.', {
              $ref: '#/components/schemas/ErrorEnvelope',
            }),
            '401': response('Missing, invalid, or disabled bearer API token.', {
              $ref: '#/components/schemas/ErrorEnvelope',
            }),
            '403': response('Device disabled, token mismatch, or LockApp/sleep reporting rejected.', {
              $ref: '#/components/schemas/ErrorEnvelope',
            }),
            '500': response('Unexpected server error.', {
              $ref: '#/components/schemas/ErrorEnvelope',
            }),
          },
        },
      },
      '/api/llm/direct': {
        get: {
          tags: ['LLM'],
          summary: 'Discover current LLM/Skills/MCP capabilities',
          description:
            'Required first call for AI clients. Detects active mode, endpoints, next steps, and whether OAuth, API key, or legacy MCP should be used.',
          parameters: [
            { $ref: '#/components/parameters/LlmMode' },
            { $ref: '#/components/parameters/LlmAi' },
            headerParameter('LLM-Skills-Mode', 'Optional mode hint.', false),
            headerParameter('LLM-Skills-Token', 'Optional token header.', false),
            { $ref: '#/components/parameters/LlmSkillsAi' },
            { $ref: '#/components/parameters/LlmSkillsScope' },
          ],
          responses: {
            '200': response('Capabilities resolved and ready for client use.', {
              $ref: '#/components/schemas/LlmDirectSuccess',
            }),
            '400': response('Deprecated query-token usage or other malformed request.', {
              $ref: '#/components/schemas/LlmDirectFailure',
            }),
            '401': response('Token missing or unsupported for the requested mode.', {
              $ref: '#/components/schemas/LlmDirectFailure',
            }),
            '403': response('Mode mismatch or unavailable flow.', {
              $ref: '#/components/schemas/LlmDirectFailure',
            }),
            '404': response('LLM debugging is disabled.', {
              $ref: '#/components/schemas/LlmDirectFailure',
            }),
            '503': response('Server not configured for the requested capability yet.', {
              $ref: '#/components/schemas/LlmDirectFailure',
            }),
          },
        },
      },
      '/api/llm/md': {
        get: {
          tags: ['LLM'],
          summary: 'Read the AI-oriented protocol markdown',
          description:
            'Returns a Markdown protocol document written for AI clients. Scalar references it as supplemental guidance rather than replacing it.',
          responses: {
            '200': {
              description: 'Markdown protocol document.',
              content: { 'text/markdown': { schema: { type: 'string' } } },
            },
          },
        },
      },
      '/api/llm/settings': {
        get: {
          tags: ['LLM'],
          summary: 'Read redacted site settings',
          security: skillsHeaderSecurity(
            'Use the Skills header set returned by GET /api/llm/direct. OAuth mode also requires LLM-Skills-AI.',
          ),
          parameters: [
            { $ref: '#/components/parameters/LlmSkillsAi' },
            { $ref: '#/components/parameters/LlmSkillsScope' },
            { $ref: '#/components/parameters/LlmSkillsRequestId' },
          ],
          responses: {
            '200': response('Redacted site settings.', {
              allOf: [
                { $ref: '#/components/schemas/SuccessEnvelope' },
                { type: 'object', properties: { data: { $ref: '#/components/schemas/SiteConfig' } } },
              ],
            }),
            '401': response('Missing or invalid Skills headers/token.', {
              $ref: '#/components/schemas/ErrorEnvelope',
            }),
            '403': response('Mode mismatch or AI/token mismatch.', {
              $ref: '#/components/schemas/ErrorEnvelope',
            }),
            '500': response('Unexpected server error.', {
              $ref: '#/components/schemas/ErrorEnvelope',
            }),
          },
        },
        patch: {
          tags: ['LLM'],
          summary: 'Update allowed site settings fields',
          description:
            'Send only the minimal fields that should change. Restricted fields are rejected.',
          security: skillsHeaderSecurity(
            'Use the Skills header set returned by GET /api/llm/direct. OAuth mode also requires LLM-Skills-AI.',
          ),
          parameters: [
            { $ref: '#/components/parameters/LlmSkillsAi' },
            { $ref: '#/components/parameters/LlmSkillsScope' },
            { $ref: '#/components/parameters/LlmSkillsRequestId' },
          ],
          requestBody: {
            required: true,
            content: jsonContent(
              { $ref: '#/components/schemas/SiteConfigPatch' },
              {
                minimalThemeUpdate: {
                  value: {
                    pageTitle: 'Waken Wa',
                    currentlyText: 'Current Status',
                    themePreset: 'customSurface',
                    themeCustomSurface: { primary: '#da6d4b', accent: '#2d8f85' },
                  },
                },
              },
            ),
          },
          responses: {
            '200': response('Updated redacted site settings.', {
              allOf: [
                { $ref: '#/components/schemas/SuccessEnvelope' },
                { type: 'object', properties: { data: { $ref: '#/components/schemas/SiteConfig' } } },
              ],
            }),
            '400': response('Invalid JSON object or invalid field value.', {
              $ref: '#/components/schemas/ErrorEnvelope',
            }),
            '401': response('Missing or invalid Skills headers/token.', {
              $ref: '#/components/schemas/ErrorEnvelope',
            }),
            '403': response('Restricted field included or mode mismatch.', {
              $ref: '#/components/schemas/ErrorEnvelope',
            }),
            '500': response('Unexpected server error.', {
              $ref: '#/components/schemas/ErrorEnvelope',
            }),
          },
        },
      },
      '/api/llm/activity/apps-export': {
        get: {
          tags: ['LLM'],
          summary: 'Export used activity apps',
          security: skillsHeaderSecurity('Uses the same Skills auth headers as /api/llm/settings.'),
          parameters: [
            { $ref: '#/components/parameters/LlmSkillsAi' },
            { $ref: '#/components/parameters/LlmSkillsScope' },
            { $ref: '#/components/parameters/LlmSkillsRequestId' },
          ],
          responses: {
            '200': response('Grouped activity app export.', {
              allOf: [
                { $ref: '#/components/schemas/SuccessEnvelope' },
                { type: 'object', properties: { data: { $ref: '#/components/schemas/AppsExport' } } },
              ],
            }),
            '401': response('Missing or invalid Skills headers/token.', {
              $ref: '#/components/schemas/ErrorEnvelope',
            }),
            '403': response('Mode mismatch or AI/token mismatch.', {
              $ref: '#/components/schemas/ErrorEnvelope',
            }),
            '500': response('Unexpected server error.', {
              $ref: '#/components/schemas/ErrorEnvelope',
            }),
          },
        },
      },
      '/api/llm/oauth/exchange': {
        post: {
          tags: ['LLM'],
          summary: 'Exchange OAuth authorize code for a Skills token',
          description:
            'OAuth-only endpoint. Send the short-lived authorize code via LLM-Skills-Token and the same stable AI name via LLM-Skills-AI.',
          security: skillsHeaderSecurity(
            'Requires LLM-Skills-Mode: oauth, the authorize code in LLM-Skills-Token, and the original LLM-Skills-AI value.',
          ),
          parameters: [
            { $ref: '#/components/parameters/LlmSkillsAi' },
            { $ref: '#/components/parameters/LlmSkillsRequestId' },
          ],
          requestBody: {
            required: false,
            content: jsonContent({ type: 'object', additionalProperties: false }),
          },
          responses: {
            '200': response('OAuth token issued successfully.', {
              $ref: '#/components/schemas/OauthExchange',
            }),
            '401': response('Missing/invalid code, AI mismatch, not approved, or expired.', {
              $ref: '#/components/schemas/ErrorEnvelope',
            }),
            '403': response('Current server mode is not OAuth.', {
              $ref: '#/components/schemas/ErrorEnvelope',
            }),
            '404': response('LLM debugging is disabled.', {
              $ref: '#/components/schemas/ErrorEnvelope',
            }),
          },
        },
      },
      '/api/llm/mcp/apikey': {
        get: {
          tags: ['MCP'],
          summary: 'Verify legacy MCP API key',
          description:
            'Accepts either Authorization: Bearer <key> or X-Waken-MCP-Key: <key>.',
          security: bearerSecurity('Legacy MCP API key. You may also pass X-Waken-MCP-Key instead.'),
          parameters: [{ $ref: '#/components/parameters/LlmMcpKey' }],
          responses: {
            '200': response('Legacy MCP key is valid.', {
              allOf: [
                { $ref: '#/components/schemas/SuccessEnvelope' },
                {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'object',
                      properties: {
                        enabled: { type: 'boolean' },
                        configured: { type: 'boolean' },
                        valid: { type: 'boolean' },
                        enabledBy: { type: 'string' },
                      },
                    },
                  },
                },
              ],
            }),
            '400': response('Deprecated query-token usage.', { $ref: '#/components/schemas/ErrorEnvelope' }),
            '401': response('Missing or invalid MCP API key.', { $ref: '#/components/schemas/ErrorEnvelope' }),
            '403': response('Legacy MCP mode not enabled.', { $ref: '#/components/schemas/ErrorEnvelope' }),
            '503': response('Legacy MCP key has not been configured.', { $ref: '#/components/schemas/ErrorEnvelope' }),
          },
        },
        post: {
          tags: ['MCP'],
          summary: 'Verify legacy MCP API key (POST alias)',
          description: 'Behavior is identical to GET /api/llm/mcp/apikey.',
          security: bearerSecurity('Legacy MCP API key. You may also pass X-Waken-MCP-Key instead.'),
          parameters: [{ $ref: '#/components/parameters/LlmMcpKey' }],
          requestBody: {
            required: false,
            content: jsonContent({ type: 'object', additionalProperties: false }),
          },
          responses: {
            '200': response('Legacy MCP key is valid.', {
              allOf: [
                { $ref: '#/components/schemas/SuccessEnvelope' },
                {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'object',
                      properties: {
                        enabled: { type: 'boolean' },
                        configured: { type: 'boolean' },
                        valid: { type: 'boolean' },
                        enabledBy: { type: 'string' },
                      },
                    },
                  },
                },
              ],
            }),
            '400': response('Deprecated query-token usage.', { $ref: '#/components/schemas/ErrorEnvelope' }),
            '401': response('Missing or invalid MCP API key.', { $ref: '#/components/schemas/ErrorEnvelope' }),
            '403': response('Legacy MCP mode not enabled.', { $ref: '#/components/schemas/ErrorEnvelope' }),
            '503': response('Legacy MCP key has not been configured.', { $ref: '#/components/schemas/ErrorEnvelope' }),
          },
        },
      },
      '/api/llm/{transport}': {
        parameters: [{ $ref: '#/components/parameters/McpTransport' }],
        get: {
          tags: ['MCP'],
          summary: 'Legacy MCP transport endpoint',
          description:
            'Tool transport endpoint exposed by mcp-handler. This is not a regular REST CRUD API. Use an MCP-capable client when the server is in MCP mode.',
          security: bearerSecurity('Legacy MCP bearer key.'),
          responses: {
            '200': {
              description: 'Transport-specific MCP response.',
              content: {
                'application/json': {
                  schema: { type: 'object', additionalProperties: true },
                },
              },
            },
            '401': response('Missing or invalid MCP bearer key.', { $ref: '#/components/schemas/ErrorEnvelope' }),
            '429': response('Transport rate limit reached.', { $ref: '#/components/schemas/ErrorEnvelope' }),
          },
        },
        post: {
          tags: ['MCP'],
          summary: 'Legacy MCP transport endpoint (POST)',
          description: 'Use an MCP client instead of treating this as a standard JSON REST route.',
          security: bearerSecurity('Legacy MCP bearer key.'),
          requestBody: {
            required: false,
            content: jsonContent({ type: 'object', additionalProperties: true }),
          },
          responses: {
            '200': {
              description: 'Transport-specific MCP response.',
              content: {
                'application/json': {
                  schema: { type: 'object', additionalProperties: true },
                },
              },
            },
            '401': response('Missing or invalid MCP bearer key.', { $ref: '#/components/schemas/ErrorEnvelope' }),
            '429': response('Transport rate limit reached.', { $ref: '#/components/schemas/ErrorEnvelope' }),
          },
        },
      },
      '/api/inspiration/entries': {
        get: {
          tags: ['Inspiration'],
          summary: 'List inspiration entries',
          description:
            'Public read endpoint. The site lock must already be satisfied before this route will return entries.',
          parameters: [
            { $ref: '#/components/parameters/Limit' },
            { $ref: '#/components/parameters/Offset' },
            { $ref: '#/components/parameters/Search' },
          ],
          responses: {
            '200': response('Paginated inspiration entries.', {
              $ref: '#/components/schemas/InspirationEntriesList',
            }),
            '403': response('Site lock has not been satisfied yet.', {
              $ref: '#/components/schemas/ErrorEnvelope',
            }),
            '500': response('Unexpected server error.', {
              $ref: '#/components/schemas/ErrorEnvelope',
            }),
          },
        },
        post: {
          tags: ['Inspiration'],
          summary: 'Create an inspiration entry',
          description:
            'Write endpoint for admin sessions or bearer API tokens. Device-token writes may be further gated by the inspiration device allowlist. When attachCurrentStatus is used with a bearer token, the request must provide the current device key and can only attach that device\'s status.',
          security: cookieOrBearerSecurity(
            'Use an admin session cookie for full functionality, or a bearer API token for device-originated writes.',
          ),
          requestBody: {
            required: true,
            content: jsonContent(
              { $ref: '#/components/schemas/InspirationEntryCreate' },
              {
                plainText: {
                  value: {
                    title: 'Today',
                    content: 'A short note from the device side.',
                  },
                },
                lexical: {
                  value: {
                    title: 'Rich note',
                    contentLexical: {
                      root: {
                        children: [
                          {
                            type: 'paragraph',
                            children: [{ type: 'text', text: 'Lexical content example.' }],
                          },
                        ],
                      },
                    },
                  },
                },
                inlineImage: {
                  value: {
                    title: 'Snapshot',
                    content: 'Attached with inline image data.',
                    imageDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
                  },
                },
                adminStatusSnapshot: {
                  value: {
                    title: 'What I am doing',
                    content: 'Status was attached by the admin UI flow.',
                    attachCurrentStatus: true,
                    attachStatusDeviceHash: 'MY_DEVICE_HASH',
                    attachStatusIncludeDeviceInfo: true,
                  },
                },
              },
            ),
          },
          responses: {
            '201': response('Inspiration entry created.', {
              allOf: [
                { $ref: '#/components/schemas/SuccessEnvelope' },
                { type: 'object', properties: { data: { $ref: '#/components/schemas/InspirationEntry' } } },
              ],
            }),
            '400': response('Missing content or invalid inline image payload.', {
              $ref: '#/components/schemas/ErrorEnvelope',
            }),
            '401': response('Missing admin session and missing bearer token.', {
              $ref: '#/components/schemas/ErrorEnvelope',
            }),
            '403': response('Device token blocked by allowlist, or attachCurrentStatus attempted with a mismatched device key.', {
              $ref: '#/components/schemas/ErrorEnvelope',
            }),
            '500': response('Unexpected server error.', {
              $ref: '#/components/schemas/ErrorEnvelope',
            }),
          },
        },
        delete: {
          tags: ['Inspiration'],
          summary: 'Delete an inspiration entry',
          description: 'Admin-session only delete endpoint.',
          security: [{ sessionCookie: [] }],
          parameters: [{ $ref: '#/components/parameters/InspirationId' }],
          responses: {
            '200': response('Entry deleted.', { $ref: '#/components/schemas/SuccessEnvelope' }),
            '400': response('Missing or invalid id query parameter.', { $ref: '#/components/schemas/ErrorEnvelope' }),
            '401': response('Missing admin session.', { $ref: '#/components/schemas/ErrorEnvelope' }),
            '500': response('Unexpected server error.', { $ref: '#/components/schemas/ErrorEnvelope' }),
          },
        },
      },
      '/api/inspiration/assets': {
        post: {
          tags: ['Inspiration'],
          summary: 'Upload an inline inspiration asset',
          description:
            'Admin sessions and bearer API tokens can upload inline image assets. The response returns the stable public image URL that can be embedded into content.',
          security: cookieOrBearerSecurity(
            'Use an admin session cookie or a bearer API token. Device-token writes may be gated by the inspiration device allowlist.',
          ),
          requestBody: {
            required: true,
            content: jsonContent(
              { $ref: '#/components/schemas/InspirationAssetCreate' },
              {
                image: {
                  value: {
                    imageDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
                  },
                },
              },
            ),
          },
          responses: {
            '201': response('Asset created successfully.', {
              $ref: '#/components/schemas/InspirationAssetCreateSuccess',
            }),
            '400': response('Missing or invalid image data URL.', { $ref: '#/components/schemas/ErrorEnvelope' }),
            '401': response('Missing admin session and missing bearer token.', { $ref: '#/components/schemas/ErrorEnvelope' }),
            '403': response('Device token blocked by inspiration allowlist.', { $ref: '#/components/schemas/ErrorEnvelope' }),
            '500': response('Unexpected server error.', { $ref: '#/components/schemas/ErrorEnvelope' }),
          },
        },
      },
      '/api/inspiration/img/{publicKey}': {
        get: {
          tags: ['Inspiration'],
          summary: 'Fetch a public inspiration image',
          description:
            'Public binary image endpoint backed by stored data URLs. Returns the decoded image content for a valid publicKey.',
          parameters: [{ $ref: '#/components/parameters/InspirationPublicKey' }],
          responses: {
            '200': {
              description: 'Binary image body.',
              content: {
                'image/*': {
                  schema: { type: 'string', format: 'binary' },
                },
              },
            },
            '404': {
              description: 'Image not found or publicKey invalid.',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { error: { type: 'string' } },
                    required: ['error'],
                  },
                },
              },
            },
            '500': {
              description: 'Unexpected server error.',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { error: { type: 'string' } },
                    required: ['error'],
                  },
                },
              },
            },
          },
        },
      },
    },
  }
}
