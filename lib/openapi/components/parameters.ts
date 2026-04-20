import { headerParameter, queryParameter } from '@/lib/openapi/helpers'

export function buildParameters() {
  return {
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
  }
}
