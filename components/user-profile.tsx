'use client'

import { useActivityFeed } from '@/hooks/use-activity-feed'

interface UserProfileProps {
  name?: string
  bio?: string
  avatarUrl?: string
  note?: string
}

export function UserProfile({
  name = 'User',
  bio = 'Building something awesome',
  avatarUrl = '/avatar.jpg',
  note = '',
}: UserProfileProps) {
  const { feed } = useActivityFeed()
  const activity = feed?.activeStatuses?.[0] || feed?.recentActivities?.[0]
  const isOnline = Boolean(feed?.activeStatuses?.length)

  return (
    <div className="space-y-6">
      {/* Top Row: avatar + name/bio */}
      <div className="flex items-center gap-4">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <div className="w-14 h-14 rounded-full overflow-hidden border border-border">
            <img
              src={avatarUrl}
              alt={name}
              width={56}
              height={56}
              className="w-full h-full object-cover"
              loading="eager"
            />
          </div>
          <div
            className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background ${
              isOnline ? 'bg-online animate-pulse' : 'bg-muted-foreground/40'
            }`}
          />
        </div>

        {/* Name & Bio */}
        <div>
          <h1 className="text-base font-medium text-foreground leading-snug">
            {name}
          </h1>
          <p className="text-sm text-muted-foreground font-light mt-0.5">
            {bio}
          </p>
        </div>
      </div>

      {/* Note / Thought of the day */}
      {note && (
        <p className="text-sm text-foreground/70 font-light leading-relaxed border-l-2 border-border pl-4">
          {note}
        </p>
      )}

      {/* Currently doing inline summary */}
      {activity && (
        <div className="flex items-center gap-2 text-sm">
          {isOnline ? (
            <div className="w-1.5 h-1.5 rounded-full bg-online animate-pulse flex-shrink-0" />
          ) : (
            <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 flex-shrink-0" />
          )}
          <span className="text-muted-foreground font-light">
            {isOnline ? '正在使用 ' : '最近使用 '}
            <span className="text-foreground">{activity.processName}</span>
            {activity.processTitle && (
              <span className="text-muted-foreground">
                {' '}— {activity.processTitle.length > 40
                  ? activity.processTitle.slice(0, 40) + '...'
                  : activity.processTitle}
              </span>
            )}
          </span>
        </div>
      )}
    </div>
  )
}
