import 'server-only'

import { getSiteConfigMemoryFirst } from '@/lib/site-config-cache'

export async function isOpenApiDocsEnabled(): Promise<boolean> {
  const config = await getSiteConfigMemoryFirst()
  if (!config || typeof config !== 'object') return true
  return (config as { openApiDocsEnabled?: unknown }).openApiDocsEnabled !== false
}
