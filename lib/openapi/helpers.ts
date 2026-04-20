import type { JsonSchema } from '@/lib/openapi/types'

export function jsonContent(schema: JsonSchema, examples?: Record<string, unknown>) {
  return {
    'application/json': {
      schema,
      ...(examples ? { examples } : {}),
    },
  }
}

export function response(
  description: string,
  schema: JsonSchema,
  examples?: Record<string, unknown>,
) {
  return {
    description,
    content: jsonContent(schema, examples),
  }
}

export function headerParameter(
  name: string,
  description: string,
  required = false,
  example?: string,
) {
  return {
    name,
    in: 'header',
    required,
    description,
    schema: { type: 'string' },
    ...(example ? { example } : {}),
  }
}

export function queryParameter(
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

export function bearerSecurity(description: string) {
  return [{ bearerAuth: [], _note: description }]
}

export function skillsHeaderSecurity(description: string) {
  return [{ skillsModeHeader: [], skillsTokenHeader: [], _note: description }]
}

export function cookieOrBearerSecurity(description: string) {
  return [
    { sessionCookie: [], _note: description },
    { bearerAuth: [], _note: description },
  ]
}
