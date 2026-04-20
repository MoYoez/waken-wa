import { clearActivityFeedDataCache } from '@/lib/activity-feed'
import {
  redactSiteConfigForClient,
  type SiteConfigRecord,
} from '@/lib/llm-site-config-helpers'
import { safeSiteConfigUpsert } from '@/lib/safe-site-config-upsert'
import { getSiteConfigMemoryFirst } from '@/lib/site-config-cache'

export async function persistSiteConfigValues(siteConfigValues: Record<string, unknown>) {
  const upsertResult = await safeSiteConfigUpsert({
    where: { id: 1 },
    update: siteConfigValues,
    create: {
      id: 1,
      ...siteConfigValues,
    },
  })
  if (upsertResult.strippedColumns.length > 0) {
    console.warn(
      `[site-config] unknown DB columns stripped during upsert: ${upsertResult.strippedColumns.join(', ')}`,
    )
  }

  await clearActivityFeedDataCache()

  const config = await getSiteConfigMemoryFirst()
  if (!config) {
    const error = new Error('站点配置不存在')
    ;(error as any).status = 500
    throw error
  }

  const redacted = redactSiteConfigForClient(config as SiteConfigRecord)
  if (upsertResult.strippedColumns.length === 0) {
    return redacted
  }
  return {
    ...redacted,
    schemaWarnings: {
      strippedColumns: upsertResult.strippedColumns,
    },
  }
}
