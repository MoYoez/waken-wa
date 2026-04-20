export function buildSecuritySchemes() {
  return {
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
  }
}
