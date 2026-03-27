'use client'

import { useEffect, useMemo, useState } from 'react'

import { useActivityFeed } from '@/hooks/use-activity-feed'
import {
  buildHitokotoRequestUrl,
  type HitokotoJsonBody,
  type UserNoteHitokotoEncode,
} from '@/lib/hitokoto'

const NOTE_BOX_CLASS =
  'text-sm text-foreground/70 font-light leading-relaxed border-l-2 border-primary pl-4'

function ProfileHitokotoNote({
  categories,
  encode,
  fallbackNote,
}: {
  categories: string[]
  encode: UserNoteHitokotoEncode
  fallbackNote: string
}) {
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  const [text, setText] = useState('')
  const [uuid, setUuid] = useState<string | null>(null)

  const categoriesKey = useMemo(() => JSON.stringify([...categories].sort()), [categories])

  useEffect(() => {
    const ac = new AbortController()
    let cancelled = false
    setPhase('loading')
    const cats = JSON.parse(categoriesKey) as string[]
    const url = buildHitokotoRequestUrl(cats, encode)

    ;(async () => {
      try {
        const res = await fetch(url, { signal: ac.signal })
        if (!res.ok) throw new Error('hitokoto http')
        if (encode === 'text') {
          const t = (await res.text()).trim()
          if (!cancelled) {
            setText(t)
            setUuid(null)
            setPhase(t ? 'ready' : 'error')
          }
          return
        }
        const data = (await res.json()) as HitokotoJsonBody
        const t = String(data.hitokoto ?? '').trim()
        const u = typeof data.uuid === 'string' && data.uuid.length > 0 ? data.uuid : null
        if (!cancelled) {
          setText(t)
          setUuid(u)
          setPhase(t ? 'ready' : 'error')
        }
      } catch {
        if (!cancelled) setPhase('error')
      }
    })()

    return () => {
      cancelled = true
      ac.abort()
    }
  }, [categoriesKey, encode])

  if (phase === 'loading') {
    return (
      <p className={`${NOTE_BOX_CLASS} animate-pulse text-muted-foreground`}>加载一言…</p>
    )
  }

  if (phase === 'error') {
    if (fallbackNote.trim()) {
      return <p className={NOTE_BOX_CLASS}>{fallbackNote}</p>
    }
    return (
      <p className={`${NOTE_BOX_CLASS} text-muted-foreground`}>一言暂不可用</p>
    )
  }

  if (uuid) {
    return (
      <p className={NOTE_BOX_CLASS}>
        <a
          href={`https://hitokoto.cn/?uuid=${encodeURIComponent(uuid)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
        >
          {text}
        </a>
      </p>
    )
  }

  return <p className={NOTE_BOX_CLASS}>{text}</p>
}

interface UserProfileProps {
  name?: string
  bio?: string
  avatarUrl?: string
  note?: string
  noteHitokotoEnabled?: boolean
  noteHitokotoCategories?: string[]
  noteHitokotoEncode?: UserNoteHitokotoEncode
}

export function UserProfile({
  name = 'User',
  bio = 'Building something awesome',
  avatarUrl = '/avatar.jpg',
  note = '',
  noteHitokotoEnabled = false,
  noteHitokotoCategories = [],
  noteHitokotoEncode = 'json',
}: UserProfileProps) {
  const { feed } = useActivityFeed()
  const isOnline = Boolean(feed?.activeStatuses?.length)

  const showNoteBlock = Boolean(note.trim()) || noteHitokotoEnabled

  return (
    <div className="space-y-6">
      {/* Top Row: avatar + name/bio */}
      <div className="flex items-center gap-4">
        {/* Avatar — online: green dot, offline: red dot */}
        <div
          className="relative flex-shrink-0"
          aria-label={isOnline ? '在线' : '离线'}
        >
          <div
            className={`w-[4.5rem] h-[4.5rem] rounded-full overflow-hidden border-2 ring-2 ring-background ${
              isOnline ? 'border-online/60' : 'border-destructive/50'
            }`}
          >
            <img
              src={avatarUrl}
              alt={name}
              width={72}
              height={72}
              className="w-full h-full object-cover"
              loading="eager"
            />
          </div>
          <div
            className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-[3px] border-background shadow-sm ${
              isOnline ? 'bg-online animate-pulse' : 'bg-destructive'
            }`}
            title={isOnline ? '在线' : '离线'}
          />
        </div>

        {/* Name & Bio */}
        <div>
          <h1 className="text-base font-semibold text-foreground leading-snug">
            {name}
          </h1>
          <p className="text-sm text-muted-foreground font-light mt-0.5">
            {bio}
          </p>
        </div>
      </div>

      {showNoteBlock ? (
        noteHitokotoEnabled ? (
          <ProfileHitokotoNote
            categories={noteHitokotoCategories}
            encode={noteHitokotoEncode}
            fallbackNote={note}
          />
        ) : (
          <p className={NOTE_BOX_CLASS}>{note}</p>
        )
      ) : null}
    </div>
  )
}
