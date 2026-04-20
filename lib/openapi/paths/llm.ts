import {
  headerParameter,
  jsonContent,
  response,
  skillsHeaderSecurity,
} from '@/lib/openapi/helpers'

export function buildLlmPaths() {
  return {
    '/api/llm/direct': {
      get: {
        tags: ['LLM'],
        summary: 'Discover current LLM/Skills/MCP capabilities',
        description:
          'Required first call for AI clients that help manage the personal life panel. Detects active mode, endpoints, next steps, and whether OAuth, API key, or legacy MCP should be used.',
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
          'Returns a Markdown protocol document written for AI clients working on the Waken-Wa life panel. Scalar references it as supplemental guidance rather than replacing it.',
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
  }
}
