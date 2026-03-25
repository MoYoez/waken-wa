'use client'

import { useEffect, useState } from 'react'
import { UserProfile } from '@/components/user-profile'
import { CurrentStatus } from '@/components/current-status'
import { ActivityTimeline } from '@/components/activity-timeline'

export default function Home() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  const userName = process.env.NEXT_PUBLIC_USER_NAME || 'Koi'
  const userBio = process.env.NEXT_PUBLIC_USER_BIO || 'Code with patience and optimism.'
  const avatarUrl = process.env.NEXT_PUBLIC_AVATAR_URL || '/avatar.jpg'
  const userNote = process.env.NEXT_PUBLIC_USER_NOTE || 'Writing code, sipping coffee, thinking about the universe...'

  return (
    <>
      {/* Animated Background */}
      <div className="animated-bg">
        <div className="floating-orb floating-orb-1" />
        <div className="floating-orb floating-orb-2" />
        <div className="floating-orb floating-orb-3" />
      </div>

      <main className="min-h-screen relative">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-16 pb-24 space-y-16">
          {/* Profile */}
          <UserProfile
            name={userName}
            bio={userBio}
            avatarUrl={avatarUrl}
            note={userNote}
          />

          {/* Divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

          {/* Current Activity Detail */}
          <section>
            <h2 className="text-xs text-muted-foreground uppercase tracking-widest mb-6">
              currently
            </h2>
            <CurrentStatus />
          </section>

          {/* Timeline */}
          <section>
            <h2 className="text-xs text-muted-foreground uppercase tracking-widest mb-6">
              earlier
            </h2>
            <ActivityTimeline />
          </section>
        </div>

        {/* Footer */}
        <footer className="border-t border-border/50 mt-16 backdrop-blur-sm">
          <div className="max-w-3xl mx-auto px-4 py-8 sm:px-6">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <p>updates every 30 seconds</p>
              <a href="/admin" className="hover:text-foreground transition-colors">
                admin
              </a>
            </div>
          </div>
        </footer>
      </main>
    </>
  )
}

