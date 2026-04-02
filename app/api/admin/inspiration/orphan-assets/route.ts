import { and, eq, inArray, isNull, lt } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { inspirationAssets, inspirationEntries, siteConfig } from '@/lib/drizzle-schema'
import {
  extractInspirationImagePublicKeysFromText,
  inspirationInlineImageUrl,
} from '@/lib/inspiration-inline-images'
import { extractInspirationImagePublicKeysFromLexical } from '@/lib/inspiration-lexical'
import { INSPIRATION_ORPHAN_ASSET_GRACE_PERIOD_MS } from '@/lib/inspiration-admin-constants'
import { sqlDate } from '@/lib/sql-timestamp'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function requireAdmin() {
  const session = await getSession()
  return session ?? null
}

function toDate(value: unknown): Date | null {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value === 'string') {
    const d = new Date(value)
    return Number.isFinite(d.getTime()) ? d : null
  }
  return null
}

async function scanReferencedAssetPublicKeys(): Promise<Set<string>> {
  const keys = new Set<string>()

  const entryRows = await db
    .select({
      title: inspirationEntries.title,
      content: inspirationEntries.content,
      contentLexical: inspirationEntries.contentLexical,
      statusSnapshot: inspirationEntries.statusSnapshot,
    })
    .from(inspirationEntries)

  for (const row of entryRows) {
    if (typeof row.title === 'string' && row.title.length > 0) {
      for (const k of extractInspirationImagePublicKeysFromText(row.title)) keys.add(k)
    }
    if (typeof row.content === 'string' && row.content.length > 0) {
      for (const k of extractInspirationImagePublicKeysFromText(row.content)) keys.add(k)
    }
    for (const k of extractInspirationImagePublicKeysFromLexical(row.contentLexical)) keys.add(k)
    if (typeof row.statusSnapshot === 'string' && row.statusSnapshot.length > 0) {
      for (const k of extractInspirationImagePublicKeysFromText(row.statusSnapshot)) keys.add(k)
    }
  }

  const [cfg] = await db.select().from(siteConfig).where(eq(siteConfig.id, 1)).limit(1)
  if (cfg) {
    for (const value of Object.values(cfg)) {
      if (typeof value !== 'string' || value.length === 0) continue
      for (const k of extractInspirationImagePublicKeysFromText(value)) keys.add(k)
    }
  }

  return keys
}

export async function GET() {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ success: false, error: '未授权' }, { status: 401 })
  }

  try {
    const referenced = await scanReferencedAssetPublicKeys()
    const now = Date.now()
    const cutoff = sqlDate(new Date(now - INSPIRATION_ORPHAN_ASSET_GRACE_PERIOD_MS))

    const rows: Array<{ publicKey: string; createdAt: unknown }> = await db
      .select({
        publicKey: inspirationAssets.publicKey,
        createdAt: inspirationAssets.createdAt,
      })
      .from(inspirationAssets)
      .where(and(isNull(inspirationAssets.inspirationEntryId), lt(inspirationAssets.createdAt, cutoff)))

    const data = rows
      .map((row: { publicKey: string; createdAt: unknown }) => {
        const key = String(row.publicKey).toLowerCase()
        const created = toDate(row.createdAt)
        const createdAtIso = created ? created.toISOString() : null
        const ageMinutes = created ? Math.max(0, Math.floor((now - created.getTime()) / 60000)) : null
        const eligibleForDelete =
          created ? now - created.getTime() >= INSPIRATION_ORPHAN_ASSET_GRACE_PERIOD_MS : false
        const referencedNow = referenced.has(key)
        return {
          publicKey: key,
          url: inspirationInlineImageUrl(key),
          createdAt: createdAtIso,
          ageMinutes,
          eligibleForDelete: eligibleForDelete && !referencedNow,
          referenced: referencedNow,
        }
      })
      .filter((x: { referenced: boolean }) => !x.referenced)
      .sort(
        (a: { ageMinutes: number | null }, b: { ageMinutes: number | null }) =>
          (b.ageMinutes ?? 0) - (a.ageMinutes ?? 0),
      )

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('list orphan inspiration assets failed:', error)
    return NextResponse.json({ success: false, error: '读取失败' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ success: false, error: '未授权' }, { status: 401 })
  }

  try {
    const body: unknown = await request.json().catch(() => ({}))
    const publicKeysRaw =
      body && typeof body === 'object' && Array.isArray((body as Record<string, unknown>).publicKeys)
        ? ((body as Record<string, unknown>).publicKeys as unknown[])
        : []
    const keys = [
      ...new Set(publicKeysRaw.map((x) => String(x ?? '').trim().toLowerCase())),
    ].filter((x) => x.length > 0)
    if (keys.length === 0) {
      return NextResponse.json({ success: false, error: '缺少 publicKeys' }, { status: 400 })
    }

    const referenced = await scanReferencedAssetPublicKeys()
    const deletable = keys.filter((k) => !referenced.has(k))
    if (deletable.length === 0) {
      return NextResponse.json({ success: true, data: { deleted: 0, skipped: keys.length } })
    }

    const cutoff = sqlDate(new Date(Date.now() - INSPIRATION_ORPHAN_ASSET_GRACE_PERIOD_MS))

    const existing = await db
      .select({
        publicKey: inspirationAssets.publicKey,
      })
      .from(inspirationAssets)
      .where(
        and(
          isNull(inspirationAssets.inspirationEntryId),
          lt(inspirationAssets.createdAt, cutoff),
          inArray(inspirationAssets.publicKey as any, deletable),
        ),
      )

    const existingKeys = new Set(existing.map((r: { publicKey: string }) => String(r.publicKey).toLowerCase()))
    const finalKeys = deletable.filter((k) => existingKeys.has(k))

    if (finalKeys.length === 0) {
      return NextResponse.json({ success: true, data: { deleted: 0, skipped: keys.length } })
    }

    await db
      .delete(inspirationAssets)
      .where(
        and(
          isNull(inspirationAssets.inspirationEntryId),
          lt(inspirationAssets.createdAt, cutoff),
          inArray(inspirationAssets.publicKey as any, finalKeys),
        ),
      )

    return NextResponse.json({
      success: true,
      data: {
        deleted: finalKeys.length,
        skipped: keys.length - finalKeys.length,
      },
    })
  } catch (error) {
    console.error('delete orphan inspiration assets failed:', error)
    return NextResponse.json({ success: false, error: '删除失败' }, { status: 500 })
  }
}
