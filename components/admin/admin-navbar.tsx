'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { LogOut, User } from 'lucide-react'

function AdminClock() {
  const [currentTime, setCurrentTime] = useState<Date>(new Date())
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setCurrentTime(new Date())
    const interval = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  if (!mounted) {
    return null
  }

  const formattedTime = currentTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }) + ' • ' + currentTime.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  })

  return (
    <div className="ml-auto flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 text-rose-500 px-3 py-1.5 rounded-xl text-xs font-mono font-medium shadow-sm">
      {formattedTime}
    </div>
  )
}

export function AdminNavbar() {
  const router = useRouter()
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  async function handleLogout() {
    setUserMenuOpen(false)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      router.push('/login')
      router.refresh()
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur">
      <div className="md:hidden">
        <Image alt="Toku Takoyaki" className="rounded-full object-cover" height={36} src="/toku-logo.png" width={36} />
      </div>
      <span className="truncate text-sm font-semibold tracking-tight md:hidden">Admin Console</span>
      
      {/* Realtime Clock - Top Right */}
      <AdminClock />

      <div className="relative ml-auto sm:hidden">
        <button
          type="button"
          onClick={() => setUserMenuOpen((value) => !value)}
          aria-expanded={userMenuOpen}
          aria-haspopup="menu"
          aria-label="Open user menu"
          className="inline-flex size-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <User className="size-5" aria-hidden="true" />
        </button>
        {userMenuOpen && (
          <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-36 rounded-xl border border-border bg-popover p-1 shadow-lg">
            <button type="button" role="menuitem" onClick={handleLogout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
              <LogOut className="size-4" aria-hidden="true" />
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
