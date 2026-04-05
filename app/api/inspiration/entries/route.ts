import { count, desc, eq, or, sql } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

import { ACTIVITY_FEED_DEFAULT_LIMIT } from '@/lib/activity-api-constants'
import { getActivityFeedData } from '@/lib/activity-feed'
import {
  ADMIN_LIST_DEFAULT_PAGE_SIZE,
  ADMIN_LIST_MAX_PAGE_SIZE,
} from '@/lib/admin-list-constants'
import { getBearerApiTokenRecord, getSession, isSiteLockSatisfied } from '@/lib/auth'
import { db } from '@/lib/db'
import { devices, inspirationEntries, siteConfig } from '@/lib/drizzle-schema'
import {
  extractInspirationDeviceKey,
  gateInspirationApiForDevice,
} from '@/lib/inspiration-device-allowlist'
import {
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

export async function GET(request: NextRequest) {
  try {
    if (!(await isSiteLockSatisfied())) {
      return NextResponse.json({ success: false, error: '页面已锁定' }, { status: 403 })
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

    const [items, [totalRow], [config]] = await Promise.all([
      (searchCond ? listBase.where(searchCond) : listBase).limit(limit).offset(offset),
      searchCond ? countBase.where(searchCond) : countBase,
      db.select({ displayTimezone: siteConfig.displayTimezone }).from(siteConfig).limit(1),
    ])
    const displayTimezone = normalizeTimezone(config?.displayTimezone)

    return NextResponse.json({
      success: true,
      data: items,
      displayTimezone,
      pagination: { limit, offset, total: Number(totalRow?.c ?? 0) },
    })
  } catch (error) {
    console.error('获取灵感条目失败:', error)
    return NextResponse.json({ success: false, error: '获取失败' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  const apiToken = await getBearerApiTokenRecord(request.headers.get('authorization'))

  if (!session && !apiToken) {
    return NextResponse.json({ success: false, error: '未授权' }, { status: 401 })
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
              '附带当前状态时需要提供设备身份牌（X-Device-Key 或 generatedHashKey）',
          },
          { status: 400 },
        )
      }
      if (
        attachStatusDeviceHashResolved &&
        attachStatusDeviceHashResolved !== tokenDeviceKey.trim().toLowerCase()
      ) {
        return NextResponse.json(
          { success: false, error: '附带当前状态仅允许使用当前设备身份牌' },
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
      return NextResponse.json({ success: false, error: '缺少 content' }, { status: 400 })
    }

    const imageDataUrlRaw = body?.imageDataUrl ?? body?.dataUrl ?? body?.image_data_url
    const imageDataUrl =
      typeof imageDataUrlRaw === 'string' && imageDataUrlRaw.trim().length > 0
        ? imageDataUrlRaw.trim()
        : null

    if (imageDataUrl) {
      const imgCheck = validateInlineImageDataUrl(imageDataUrl)
      if (!imgCheck.ok) {
        return NextResponse.json({ success: false, error: imgCheck.error }, { status: 400 })
      }
    }

    let statusSnapshot: string | null = null
    if (attachCurrentStatus && session) {
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

    return NextResponse.json({ success: true, data: entry }, { status: 201 })
  } catch (error) {
    console.error('提交灵感条目失败:', error)
    return NextResponse.json({ success: false, error: '提交失败' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ success: false, error: '未授权' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const idRaw = searchParams.get('id')
    const id = idRaw ? parseInt(idRaw) : NaN
    if (!id || Number.isNaN(id)) {
      return NextResponse.json({ success: false, error: '缺少有效的 id' }, { status: 400 })
    }

    await db.delete(inspirationEntries).where(eq(inspirationEntries.id, id))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('删除灵感条目失败:', error)
    return NextResponse.json({ success: false, error: '删除失败' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ success: false, error: '未授权' }, { status: 401 })
  }

  try {
    const body = await readJsonObject(request)
    const id = Number(body?.id)
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ success: false, error: '缺少有效的 id' }, { status: 400 })
    }

    const [existingEntry] = await db
      .select({ id: inspirationEntries.id })
      .from(inspirationEntries)
      .where(eq(inspirationEntries.id, id))
      .limit(1)
    if (!existingEntry) {
      return NextResponse.json({ success: false, error: '灵感不存在' }, { status: 404 })
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
      return NextResponse.json({ success: false, error: '缺少 content' }, { status: 400 })
    }

    const imageDataUrlRaw = body?.imageDataUrl ?? body?.dataUrl ?? body?.image_data_url
    const imageDataUrl =
      typeof imageDataUrlRaw === 'string' && imageDataUrlRaw.trim().length > 0
        ? imageDataUrlRaw.trim()
        : null
    if (imageDataUrl) {
      const imgCheck = validateInlineImageDataUrl(imageDataUrl)
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
        imageDataUrl,
        statusSnapshot,
        updatedAt: now,
      })
      .where(eq(inspirationEntries.id, id))
      .returning()

    await syncInspirationAssetsForEntry(id, content, contentLexical)

    return NextResponse.json({ success: true, data: entry })
  } catch (error) {
    console.error('更新灵感条目失败:', error)
    return NextResponse.json({ success: false, error: '保存失败' }, { status: 500 })
  }
}
