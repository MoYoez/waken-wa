import { NextResponse } from 'next/server'

import { isSiteLockSatisfied } from '@/lib/auth'
import { parseScheduleCoursesJson } from '@/lib/schedule-courses'
import { exportCoursesToIcs } from '@/lib/schedule-ics'
import { getSiteConfigMemoryFirst } from '@/lib/site-config-cache'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Read-only ICS subscription for the owner's schedule.
 * Calendar apps (Google/Apple/Outlook) can subscribe to this URL to mirror courses.
 */
export async function GET() {
  if (!(await isSiteLockSatisfied())) {
    return NextResponse.json({ success: false, error: 'Page is locked' }, { status: 403 })
  }

  try {
    const config = await getSiteConfigMemoryFirst()
    const parsed = parseScheduleCoursesJson(config?.scheduleCourses ?? null)
    const courses = parsed.ok ? parsed.data : []
    const ics = exportCoursesToIcs(courses)
    return new NextResponse(ics, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="schedule.ics"',
        'Cache-Control': 'public, max-age=300',
      },
    })
  } catch (error) {
    console.error('[schedule ics] export failed:', error)
    return NextResponse.json({ success: false, error: 'Failed to build calendar' }, { status: 500 })
  }
}
