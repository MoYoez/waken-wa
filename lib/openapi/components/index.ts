import { buildParameters } from '@/lib/openapi/components/parameters'
import { buildSchemas } from '@/lib/openapi/components/schemas'
import { buildSecuritySchemes } from '@/lib/openapi/components/security'

export function buildComponents(baseUrl: string) {
  return {
    schemas: buildSchemas(baseUrl),
    securitySchemes: buildSecuritySchemes(),
    parameters: buildParameters(),
  }
}
