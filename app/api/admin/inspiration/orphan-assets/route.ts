import { and, inArray, isNull, lt } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

import { requireAdminSession, unauthorizedJson } from '@/lib/admin-api-auth'
import { db } from '@/lib/db'
import { inspirationAssets } from '@/lib/drizzle-schema'
import {
  buildInspirationOrphanAssetRecord,
  getInspirationOrphanAssetCutoff,
  listDeletableInspirationOrphanAssetKeys,
  normalizeInspirationAssetPublicKeys,
  scanReferencedInspirationAssetPublicKeys,
} from '@/lib/inspiration-orphan-assets'
import { readJsonObject } from '@/lib/request-json'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  const session = await requireAdminSession()
  if (!session) {
    return unauthorizedJson()
  }

  try {
    const referenced = await scanReferencedInspirationAssetPublicKeys()
    const now = Date.now()
    const cutoff = getInspirationOrphanAssetCutoff(now)

    const rows: Array<{ publicKey: string; createdAt: unknown }> = await db
      .select({
        publicKey: inspirationAssets.publicKey,
        createdAt: inspirationAssets.createdAt,
      })
      .from(inspirationAssets)
      .where(and(isNull(inspirationAssets.inspirationEntryId), lt(inspirationAssets.createdAt, cutoff)))

    const data = rows
      .map((row: { publicKey: string; createdAt: unknown }) =>
        buildInspirationOrphanAssetRecord(row, referenced, now),
      )
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
  const session = await requireAdminSession()
  if (!session) {
    return unauthorizedJson()
  }

  try {
    const body = await readJsonObject(request)
    const publicKeysRaw = Array.isArray(body.publicKeys) ? body.publicKeys : []
    const keys = normalizeInspirationAssetPublicKeys(publicKeysRaw)
    if (keys.length === 0) {
      return NextResponse.json({ success: false, error: '缺少 publicKeys' }, { status: 400 })
    }

    const referenced = await scanReferencedInspirationAssetPublicKeys()
    const deletable = keys.filter((k) => !referenced.has(k))
    if (deletable.length === 0) {
      return NextResponse.json({ success: true, data: { deleted: 0, skipped: keys.length } })
    }

    const existingKeys = await listDeletableInspirationOrphanAssetKeys(deletable)
    const finalKeys = deletable.filter((k) => existingKeys.has(k))

    if (finalKeys.length === 0) {
      return NextResponse.json({ success: true, data: { deleted: 0, skipped: keys.length } })
    }

    const cutoff = getInspirationOrphanAssetCutoff()
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
