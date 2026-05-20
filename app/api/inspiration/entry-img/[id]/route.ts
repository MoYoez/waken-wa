import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

import { isSiteLockSatisfied } from '@/lib/auth'
import { db } from '@/lib/db'
import { inspirationEntries } from '@/lib/drizzle-schema'
import { CreateTransformedImageResponse } from '@/lib/image-transform-response'
import { parseDataImagePayload } from '@/lib/inspiration-inline-images'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const ENTRY_IMAGE_RESPONSE_OPTIONS = {
  cacheControl: 'private, max-age=300',
  defaultQuality: 72,
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    if (!(await isSiteLockSatisfied())) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const { id: rawId } = await context.params
    const id = Number.parseInt(String(rawId ?? '').trim(), 10)
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const [row] = await db
      .select({ imageDataUrl: inspirationEntries.imageDataUrl })
      .from(inspirationEntries)
      .where(eq(inspirationEntries.id, id))
      .limit(1)

    if (!row?.imageDataUrl) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const parsed = parseDataImagePayload(row.imageDataUrl)
    if (!parsed) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return CreateTransformedImageResponse(
      parsed.buffer,
      parsed.mime,
      request,
      ENTRY_IMAGE_RESPONSE_OPTIONS,
    )
  } catch (error) {
    console.error('inspiration entry image GET failed:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
