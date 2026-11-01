'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Package,
  Settings,
  UtensilsCrossed,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type NavItem = { label: string; href: string; icon: LucideIcon }

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard Overview', href: '/admin', icon: LayoutDashboard },
  { label: 'Menu', href: '/admin/menu', icon: UtensilsCrossed },
  { label: 'Inventory', href: '/admin/inventory', icon: Package },
  { label: 'Staff & Roles', href: '/admin/staff', icon: Users },
  { label: 'Settings', href: '/admin/settings', icon: Settings },
]

/**
 * - "full": labels always visible (mobile drawer)
 * - "icons": icon-only (user-collapsed sidebar)
 * - "responsive": icon-only on tablet, labels on desktop (lg+)
 */
export type NavMode = 'full' | 'icons' | 'responsive'

const LINK_LAYOUT: Record<NavMode, string> = {
  full: 'justify-start px-3',
  icons: 'justify-center px-0',
  responsive: 'justify-center px-0 lg:justify-start lg:px-3',
}

const LABEL_CLASS: Record<NavMode, string> = {
  full: 'truncate',
  icons: 'sr-only',
  responsive: 'sr-only lg:not-sr-only lg:truncate',
}

export function AdminNavLinks({ mode, onNavigate }: { mode: NavMode; onNavigate?: () => void }) {
  const pathname = usePathname()

  return (
    <ul className="flex flex-col gap-1">
      {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
        const isActive = href === '/admin' ? pathname === href : pathname.startsWith(href)
        return (
          <li key={href}>
            <Link
              href={href}
              title={mode === 'full' ? undefined : label}
              aria-current={isActive ? 'page' : undefined}
              onClick={onNavigate}
              className={cn(
                'flex h-10 items-center gap-3 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600',
                LINK_LAYOUT[mode],
                isActive
                  ? 'bg-rose-600/10 text-rose-500 border-r-2 border-rose-600'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              <span className={LABEL_CLASS[mode]}>{label}</span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
