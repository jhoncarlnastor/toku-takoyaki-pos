'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { ChevronsLeft, ChevronsRight, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AdminNavLinks } from '@/components/admin/admin-nav'
import { supabase } from '@/lib/supabase'

/**
 * Hidden on mobile (the top navbar's drawer takes over), icon-only rail on
 * tablet (md–lg), and full width with a manual collapse toggle on desktop (lg+).
 */
export function AdminSidebar() {
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const mode = collapsed ? 'icons' : 'responsive'

  async function handleLogout() {
    try {
      await supabase.auth.signOut()
    } catch {
      // ignore
    }
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // ignore
    }
    try {
      localStorage.removeItem('user_session')
    } catch {
      // ignore
    }
    router.push('/login')
    router.refresh()
  }

  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-svh shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-out md:flex',
        collapsed ? 'w-16' : 'w-16 lg:w-64',
      )}
    >
      <div
        className={cn(
          'flex h-16 items-center gap-3 border-b border-sidebar-border px-3',
          collapsed ? 'justify-center' : 'justify-center lg:justify-start',
        )}
      >
        <Image alt="Toku Takoyaki" className="rounded-full object-cover" height={36} src="/toku-logo.png" width={36} />
        <span className={cn('truncate text-sm font-semibold tracking-tight', collapsed ? 'hidden' : 'hidden lg:inline')}>
          Admin Console
        </span>
      </div>

      <nav aria-label="Admin" className="flex-1 overflow-y-auto p-2">
        <AdminNavLinks mode={mode} />
      </nav>

      <div className="mt-auto border-t border-sidebar-border p-2">
        <button
          type="button"
          onClick={handleLogout}
          aria-label="Logout"
          className={cn(
            'mb-2 flex h-10 w-full cursor-pointer items-center gap-3 rounded-xl text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
            collapsed ? 'justify-center' : 'justify-center lg:justify-start lg:px-3',
          )}
        >
          <LogOut className="size-4 shrink-0" aria-hidden="true" />
          <span className={collapsed ? 'sr-only' : 'sr-only lg:not-sr-only'}>Logout</span>
        </button>
      </div>

      <div className="hidden border-t border-sidebar-border p-2 lg:block">
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cn(
            'flex h-9 w-full cursor-pointer items-center gap-2 rounded-md text-xs font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
            collapsed ? 'justify-center' : 'px-3',
          )}
        >
          {collapsed ? (
            <ChevronsRight className="size-4" aria-hidden="true" />
          ) : (
            <>
              <ChevronsLeft className="size-4" aria-hidden="true" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  )
}
