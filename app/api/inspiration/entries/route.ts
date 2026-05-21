import { count, desc, eq, or, sql } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

import { ACTIVITY_FEED_DEFAULT_LIMIT } from '@/constants/activity-api'
import {
  ADMIN_LIST_DEFAULT_PAGE_SIZE,
  ADMIN_LIST_MAX_PAGE_SIZE,
} from '@/constants/admin-list'
import { INSPIRATION_LIST_IMAGE_OPTIONS } from '@/constants/public-images'
import { getActivityFeedData } from '@/lib/activity-feed'
import { getBearerApiTokenRecord, getSession, isSiteLockSatisfied } from '@/lib/auth'
import { db } from '@/lib/db'
import { devices, inspirationAssets, inspirationEntries } from '@/lib/drizzle-schema'
import {
  extractInspirationDeviceKey,
  gateInspirationApiForDevice,
} from '@/lib/inspiration-device-allowlist'
import {
  extractInspirationEntryIdFromImageUrl,
  extractInspirationPublicKeyFromUrl,
  inspirationEntryImageUrl,
  linkInspirationAssetsToEntry,
  syncInspirationAssetsForEntry,
  validateInlineImageDataUrl,
} from '@/lib/inspiration-inline-images'
import {
  lexicalHasVisibleText,
  lexicalTextContent,
  normalizeLexicalJsonString,
} from '@/lib/inspiration-lexical'
import { parsePaginationParams } from '@/lib/pagination'
import { readJsonObject } from '@/lib/request-json'
import { getSiteConfigMemoryFirst } from '@/lib/site-config-cache'
import { sqlTimestamp } from '@/lib/sql-timestamp'
import { normalizeTimezone } from '@/lib/timezone'

function formatStatusSnapshotFromStatuses(
  statuses: Array<{ statusText?: string; processName?: string; processTitle?: string | null }>,
): string | null {
  const lines = statuses
    .map((s: { statusText?: string; processName?: string; processTitle?: string | null }) => {
      const st = String(s?.statusText ?? '').trim()
      if (st) return st
      const pn = String(s?.processName ?? '').trim()
      const pt = s?.processTitle != null ? String(s.processTitle).trim() : ''
      if (pt && pn) return `${pt} | ${pn}`
      return pn || pt || ''
    })
    .filter(Boolean)
  if (lines.length === 0) return null
  return lines.join('\n')
}

function formatDeviceSuffix(options: {
  deviceName: string
  includeBattery: boolean
  batteryPercent: number | null
}): string {
  const name = options.deviceName.trim()
  if (!name) return ''
  // Only show any device suffix when user enabled it.
  if (!options.includeBattery) return ''
  const pct = options.batteryPercent
  if (typeof pct === 'number' && Number.isFinite(pct)) {
    return `（${name} · ${Math.round(pct)}%）`
  }
  return `（${name}）`
}

// Force dynamic rendering, disable caching
export const dynamic = 'force-dynamic'
export const revalidate = 0

function toEntryResponseItem<T extends { id: number; imageDataUrl?: string | null }>(item: T) {
  const imageDataUrl = typeof item.imageDataUrl === 'string' ? item.imageDataUrl.trim() : ''
  const imageUrl = imageDataUrl ? inspirationEntryImageUrl(item.id, INSPIRATION_LIST_IMAGE_OPTIONS) : null
  return {
    ...item,
    imageDataUrl: imageUrl,
    imageUrl,
  }
}

type InspirationEntryRow = {
  id: number
  imageDataUrl?: string | null
}

async function resolveEntryImageDataUrl(input: unknown): Promise<string | null> {
  const raw = typeof input === 'string' ? input.trim() : ''
  if (typeof input === 'undefined') return null
  if (!raw) return null
  if (raw.startsWith('data:image/')) {
    return raw
  }

  const entryId = extractInspirationEntryIdFromImageUrl(raw)
  if (entryId) {
    const [entry] = await db
      .select({ imageDataUrl: inspirationEntries.imageDataUrl })
      .from(inspirationEntries)
      .where(eq(inspirationEntries.id, entryId))
      .limit(1)

    return typeof entry?.imageDataUrl === 'string' && entry.imageDataUrl.trim()
      ? entry.imageDataUrl.trim()
      : null
  }

  const publicKey = extractInspirationPublicKeyFromUrl(raw)
  if (!publicKey) {
    return null
  }

  const [asset] = await db
    .select({ imageDataUrl: inspirationAssets.imageDataUrl })
    .from(inspirationAssets)
    .where(sql`lower(cast(${inspirationAssets.publicKey} as text)) = ${publicKey}`)
    .limit(1)

  return typeof asset?.imageDataUrl === 'string' && asset.imageDataUrl.trim()
    ? asset.imageDataUrl.trim()
    : null
}

export async function GET(request: NextRequest) {
  try {
    if (!(await isSiteLockSatisfied())) {
      return NextResponse.json({ success: false, error: 'Page is locked' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const { limit, offset } = parsePaginationParams(searchParams, {
      defaultLimit: ADMIN_LIST_DEFAULT_PAGE_SIZE,
      maxLimit: ADMIN_LIST_MAX_PAGE_SIZE,
    })
    const q = searchParams.get('q')?.trim()

    const pattern = q ? `%${q}%` : null
    const searchCond =
      pattern &&
      or(
        sql`coalesce(lower(${inspirationEntries.title}), '') like lower(${pattern})`,
        sql`lower(${inspirationEntries.content}) like lower(${pattern})`,
        sql`coalesce(lower(${inspirationEntries.contentLexical}), '') like lower(${pattern})`,
        sql`coalesce(lower(${inspirationEntries.statusSnapshot}), '') like lower(${pattern})`,
      )

    const listBase = db.select().from(inspirationEntries).orderBy(desc(inspirationEntries.createdAt))
    const countBase = db.select({ c: count() }).from(inspirationEntries)

    const [items, [totalRow], config] = await Promise.all([
      (searchCond ? listBase.where(searchCond) : listBase).limit(limit).offset(offset),
      searchCond ? countBase.where(searchCond) : countBase,
      getSiteConfigMemoryFirst(),
    ])
    const displayTimezone = normalizeTimezone(config?.displayTimezone)

    return NextResponse.json({
      success: true,
      data: (items as InspirationEntryRow[]).map((item) => toEntryResponseItem(item)),
      displayTimezone,
      pagination: { limit, offset, total: Number(totalRow?.c ?? 0) },
    })
  } catch (error) {
    console.error('Failed to fetch inspiration entries:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  const apiToken = await getBearerApiTokenRecord(request.headers.get('authorization'))

  if (!session && !apiToken) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const bodyRecord =
      body && typeof body === 'object' && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : null
    if (!session && apiToken) {
      const gate = await gateInspirationApiForDevice(
        apiToken.id,
        request,
        bodyRecord,
      )
      if (!gate.ok) {
        return NextResponse.json({ success: false, error: gate.error }, { status: gate.status })
      }
    }
    const tokenDeviceKey =
      !session && apiToken ? extractInspirationDeviceKey(request, bodyRecord) : null
    const attachCurrentStatus = Boolean(body?.attachCurrentStatus)
    // Pre-computed snapshot text sent by the client (preferred path — avoids re-querying the feed).
    const preComputedStatusSnapshotRaw =
      body?.preComputedStatusSnapshot ?? body?.pre_computed_status_snapshot
    const preComputedStatusSnapshot =
      typeof preComputedStatusSnapshotRaw === 'string' ? preComputedStatusSnapshotRaw.trim() : ''
    const attachStatusDeviceHashRaw = body?.attachStatusDeviceHash ?? body?.attach_status_device_hash
    const attachStatusDeviceHash =
      typeof attachStatusDeviceHashRaw === 'string' ? attachStatusDeviceHashRaw.trim().toLowerCase() : ''
    const attachStatusActivityKeyRaw = body?.attachStatusActivityKey ?? body?.attach_status_activity_key
    const attachStatusActivityKey =
      typeof attachStatusActivityKeyRaw === 'string' ? attachStatusActivityKeyRaw.trim() : ''
    const attachStatusIncludeDeviceInfo =
      body?.attachStatusIncludeDeviceInfo === true || body?.attach_status_include_device_info === true
    const attachStatusDeviceHashes = Array.isArray(body?.attachStatusDeviceHashes)
      ? body.attachStatusDeviceHashes
          .map((item: unknown) => String(item ?? '').trim().toLowerCase())
          .filter((item: string) => item.length > 0)
      : []
    const attachStatusDeviceHashResolved =
      attachStatusDeviceHash ||
      attachStatusDeviceHashes[0] ||
      (tokenDeviceKey ? tokenDeviceKey.trim().toLowerCase() : '')

    if (attachCurrentStatus && !session && apiToken) {
      if (!tokenDeviceKey) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Attaching current status requires a device key in X-Device-Key or generatedHashKey',
          },
          { status: 400 },
        )
      }
      if (
        attachStatusDeviceHashResolved &&
        attachStatusDeviceHashResolved !== tokenDeviceKey.trim().toLowerCase()
      ) {
        return NextResponse.json(
          { success: false, error: 'Current status can only be attached for the current device key' },
          { status: 403 },
        )
      }
    }

    const titleRaw = body?.title ?? body?.heading
    const title =
      typeof titleRaw === 'string' ? titleRaw.trim() : null
    const titleFinal = title && title.length > 0 ? title : null

    const contentRaw = body?.content ?? body?.text ?? body?.body
    const contentLexicalRaw = body?.contentLexical ?? body?.content_lexical
    const contentLexical = normalizeLexicalJsonString(contentLexicalRaw)
    const contentMarkdown =
      typeof contentRaw === 'string' ? contentRaw.trim() : ''
    const contentFromLexical = lexicalTextContent(contentLexical)
    const content = contentMarkdown || contentFromLexical
    const hasLexicalContent = lexicalHasVisibleText(contentLexical)
    if (!content && !hasLexicalContent) {
      return NextResponse.json({ success: false, error: 'Missing content' }, { status: 400 })
    }

    const imageDataUrlRaw = body?.imageDataUrl ?? body?.dataUrl ?? body?.image_data_url
    const imageDataUrl = await resolveEntryImageDataUrl(imageDataUrlRaw)

    if (imageDataUrl) {
      const imgCheck = validateInlineImageDataUrl(imageDataUrl)
      if (!imgCheck.ok) {
        return NextResponse.json({ success: false, error: imgCheck.error }, { status: 400 })
      }
    }

    let statusSnapshot: string | null = null
    if (attachCurrentStatus) {
      if (preComputedStatusSnapshot) {
        // Fast path: client already computed the snapshot text from its loaded activity data.
        statusSnapshot = preComputedStatusSnapshot
      } else {
        // Fallback path: re-query the activity feed on the server side.
        // Used for external API clients that do not send preComputedStatusSnapshot.
        const [deviceRow] = attachStatusDeviceHashResolved
          ? await db
              .select({ displayName: devices.displayName })
              .from(devices)
              .where(eq(devices.generatedHashKey, attachStatusDeviceHashResolved))
              .limit(1)
          : [null]
        const selectedDeviceName = String(deviceRow?.displayName ?? '').trim()

        const feed = await getActivityFeedData(ACTIVITY_FEED_DEFAULT_LIMIT, {
          includeGeneratedHashKey: Boolean(attachStatusDeviceHashResolved),
        })
        const active = feed.activeStatuses as Array<{
          generatedHashKey?: string
          statusText?: string
          processName?: string
          processTitle?: string | null
          device?: string
          metadata?: Record<string, unknown> | null
          id?: number | string
        }>
        const recent = feed.recentActivities as Array<{
          generatedHashKey?: string
          statusText?: string
          processName?: string
          processTitle?: string | null
          device?: string
          metadata?: Record<string, unknown> | null
          id?: number | string
        }>

        const matchesActiveDevice = (item: { generatedHashKey?: string }) =>
          !attachStatusDeviceHashResolved ||
          String(item.generatedHashKey ?? '').trim().toLowerCase() === attachStatusDeviceHashResolved
        const matchesRecentDevice = (item: { device?: string }) =>
          !selectedDeviceName || String(item.device ?? '').trim() === selectedDeviceName

        const keyWanted = attachStatusActivityKey.trim()
        const pickFromKey = () => {
          const [group, rawId] = keyWanted.split(':', 2)
          if (!group || !rawId) return null
          const idStr = rawId.trim()
          if (!idStr) return null
          if (group === 'active') {
            return (
              active.find(
                (x) =>
                  matchesActiveDevice(x) &&
                  String((x as any).id ?? x.processName ?? '') === idStr,
              ) ?? null
            )
          }
          if (group === 'recent') {
            return (
              recent.find(
                (x) =>
                  matchesRecentDevice(x) &&
                  String((x as any).id ?? x.processName ?? '') === idStr,
              ) ?? null
            )
          }
          return null
        }

        const picked = keyWanted ? pickFromKey() : null
        const fallback = attachStatusDeviceHashResolved
          ? active.find(matchesActiveDevice) ?? null
          : active[0] ?? null
        const chosen = picked ?? fallback

        if (chosen) {
          statusSnapshot = formatStatusSnapshotFromStatuses([chosen])
          if (attachStatusDeviceHashResolved && statusSnapshot) {
            const deviceName = String(deviceRow?.displayName ?? (chosen as any).device ?? '').trim()
            const battRaw =
              (chosen as any).metadata && typeof (chosen as any).metadata === 'object'
                ? (chosen as any).metadata.deviceBatteryPercent
                : null
            const batt = typeof battRaw === 'number' ? battRaw : null
            statusSnapshot = `${statusSnapshot} ${formatDeviceSuffix({
              deviceName,
              includeBattery: attachStatusIncludeDeviceInfo,
              batteryPercent: batt,
            })}`.trim()
          }
        }
      }
    }

    const now = sqlTimestamp()
    const [entry] = await db
      .insert(inspirationEntries)
      .values({
        title: titleFinal,
        content,
        contentLexical,
        imageDataUrl,
        statusSnapshot,
        updatedAt: now,
      })
      .returning()

    await linkInspirationAssetsToEntry(entry!.id, content, contentLexical)

    return NextResponse.json({ success: true, data: toEntryResponseItem(entry) }, { status: 201 })
  } catch (error) {
    console.error('Failed to submit inspiration entry:', error)
    return NextResponse.json({ success: false, error: 'Submit failed' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const idRaw = searchParams.get('id')
    const id = idRaw ? parseInt(idRaw) : NaN
    if (!id || Number.isNaN(id)) {
      return NextResponse.json({ success: false, error: 'Missing a valid id' }, { status: 400 })
    }

    await db.delete(inspirationEntries).where(eq(inspirationEntries.id, id))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete inspiration entry:', error)
    return NextResponse.json({ success: false, error: 'Failed to delete' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await readJsonObject(request)
    const id = Number(body?.id)
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ success: false, error: 'Missing a valid id' }, { status: 400 })
    }

    const [existingEntry] = await db
      .select({ id: inspirationEntries.id })
      .from(inspirationEntries)
      .where(eq(inspirationEntries.id, id))
      .limit(1)
    if (!existingEntry) {
      return NextResponse.json({ success: false, error: 'Inspiration entry does not exist' }, { status: 404 })
    }

    const attachCurrentStatus = Boolean(body?.attachCurrentStatus)
    const preComputedStatusSnapshotRaw =
      body?.preComputedStatusSnapshot ?? body?.pre_computed_status_snapshot
    const preComputedStatusSnapshot =
      typeof preComputedStatusSnapshotRaw === 'string' ? preComputedStatusSnapshotRaw.trim() : ''
    const statusSnapshotRaw = body?.statusSnapshot ?? body?.status_snapshot
    const explicitStatusSnapshot =
      typeof statusSnapshotRaw === 'string' ? statusSnapshotRaw.trim() : ''
    const attachStatusDeviceHashRaw = body?.attachStatusDeviceHash ?? body?.attach_status_device_hash
    const attachStatusDeviceHash =
      typeof attachStatusDeviceHashRaw === 'string' ? attachStatusDeviceHashRaw.trim().toLowerCase() : ''
    const attachStatusActivityKeyRaw = body?.attachStatusActivityKey ?? body?.attach_status_activity_key
    const attachStatusActivityKey =
      typeof attachStatusActivityKeyRaw === 'string' ? attachStatusActivityKeyRaw.trim() : ''
    const attachStatusIncludeDeviceInfo =
      body?.attachStatusIncludeDeviceInfo === true || body?.attach_status_include_device_info === true
    const attachStatusDeviceHashes = Array.isArray(body?.attachStatusDeviceHashes)
      ? body.attachStatusDeviceHashes
          .map((item: unknown) => String(item ?? '').trim().toLowerCase())
          .filter((item: string) => item.length > 0)
      : []
    const attachStatusDeviceHashResolved = attachStatusDeviceHash || attachStatusDeviceHashes[0] || ''

    const titleRaw = body?.title ?? body?.heading
    const title = typeof titleRaw === 'string' ? titleRaw.trim() : null
    const titleFinal = title && title.length > 0 ? title : null

    const contentRaw = body?.content ?? body?.text ?? body?.body
    const contentLexicalRaw = body?.contentLexical ?? body?.content_lexical
    const contentLexical = normalizeLexicalJsonString(contentLexicalRaw)
    const contentMarkdown = typeof contentRaw === 'string' ? contentRaw.trim() : ''
    const contentFromLexical = lexicalTextContent(contentLexical)
    const content = contentMarkdown || contentFromLexical
    const hasLexicalContent = lexicalHasVisibleText(contentLexical)
    if (!content && !hasLexicalContent) {
      return NextResponse.json({ success: false, error: 'Missing content' }, { status: 400 })
    }

    const hasImageField =
      'imageDataUrl' in body || 'dataUrl' in body || 'image_data_url' in body
    const imageDataUrlRaw = body?.imageDataUrl ?? body?.dataUrl ?? body?.image_data_url
    const resolvedImageDataUrl = hasImageField
      ? await resolveEntryImageDataUrl(imageDataUrlRaw)
      : undefined
    if (resolvedImageDataUrl) {
      const imgCheck = validateInlineImageDataUrl(resolvedImageDataUrl)
      if (!imgCheck.ok) {
        return NextResponse.json({ success: false, error: imgCheck.error }, { status: 400 })
      }
    }

    let statusSnapshot: string | null = explicitStatusSnapshot || null
    if (attachCurrentStatus) {
      if (preComputedStatusSnapshot) {
        statusSnapshot = preComputedStatusSnapshot
      } else {
        const [deviceRow] = attachStatusDeviceHashResolved
          ? await db
              .select({ displayName: devices.displayName })
              .from(devices)
              .where(eq(devices.generatedHashKey, attachStatusDeviceHashResolved))
              .limit(1)
          : [null]
        const selectedDeviceName = String(deviceRow?.displayName ?? '').trim()

        const feed = await getActivityFeedData(ACTIVITY_FEED_DEFAULT_LIMIT, {
          includeGeneratedHashKey: Boolean(attachStatusDeviceHashResolved),
        })
        const active = feed.activeStatuses as Array<{
          generatedHashKey?: string
          statusText?: string
          processName?: string
          processTitle?: string | null
          device?: string
          metadata?: Record<string, unknown> | null
          id?: number | string
        }>
        const recent = feed.recentActivities as Array<{
          generatedHashKey?: string
          statusText?: string
          processName?: string
          processTitle?: string | null
          device?: string
          metadata?: Record<string, unknown> | null
          id?: number | string
        }>

        const matchesActiveDevice = (item: { generatedHashKey?: string }) =>
          !attachStatusDeviceHashResolved ||
          String(item.generatedHashKey ?? '').trim().toLowerCase() === attachStatusDeviceHashResolved
        const matchesRecentDevice = (item: { device?: string }) =>
          !selectedDeviceName || String(item.device ?? '').trim() === selectedDeviceName

        const keyWanted = attachStatusActivityKey.trim()
        const pickFromKey = () => {
          const [group, rawId] = keyWanted.split(':', 2)
          if (!group || !rawId) return null
          const idStr = rawId.trim()
          if (!idStr) return null
          if (group === 'active') {
            return (
              active.find(
                (x) =>
                  matchesActiveDevice(x) &&
                  String((x as { id?: number | string }).id ?? x.processName ?? '') === idStr,
              ) ?? null
            )
          }
          if (group === 'recent') {
            return (
              recent.find(
                (x) =>
                  matchesRecentDevice(x) &&
                  String((x as { id?: number | string }).id ?? x.processName ?? '') === idStr,
              ) ?? null
            )
          }
          return null
        }

        const picked = keyWanted ? pickFromKey() : null
        const fallback = attachStatusDeviceHashResolved
          ? active.find(matchesActiveDevice) ?? null
          : active[0] ?? null
        const chosen = picked ?? fallback

        if (chosen) {
          statusSnapshot = formatStatusSnapshotFromStatuses([chosen])
          if (attachStatusDeviceHashResolved && statusSnapshot) {
            const deviceName = String(deviceRow?.displayName ?? chosen.device ?? '').trim()
            const battRaw =
              chosen.metadata && typeof chosen.metadata === 'object'
                ? chosen.metadata.deviceBatteryPercent
                : null
            const batt = typeof battRaw === 'number' ? battRaw : null
            statusSnapshot = `${statusSnapshot} ${formatDeviceSuffix({
              deviceName,
              includeBattery: attachStatusIncludeDeviceInfo,
              batteryPercent: batt,
            })}`.trim()
          }
        }
      }
    }

    const now = sqlTimestamp()
    const [entry] = await db
      .update(inspirationEntries)
      .set({
        title: titleFinal,
        content,
        contentLexical,
        imageDataUrl:
          typeof resolvedImageDataUrl === 'undefined' ? undefined : resolvedImageDataUrl,
        statusSnapshot,
        updatedAt: now,
      })
      .where(eq(inspirationEntries.id, id))
      .returning()

    await syncInspirationAssetsForEntry(id, content, contentLexical)

    return NextResponse.json({ success: true, data: toEntryResponseItem(entry) })
  } catch (error) {
    console.error('Failed to update inspiration entry:', error)
    return NextResponse.json({ success: false, error: 'Save failed' }, { status: 500 })
  }
}
