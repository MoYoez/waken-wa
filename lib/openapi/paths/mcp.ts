import {
  bearerSecurity,
  jsonContent,
  response,
} from '@/lib/openapi/helpers'

export function buildMcpPaths() {
  return {
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
  }
}
