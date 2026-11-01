'use client'

import { useSyncExternalStore } from 'react'
import { useTheme } from 'next-themes'
import { Check, Monitor, Moon, Sun, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

const THEMES: { value: string; label: string; description: string; icon: LucideIcon }[] = [
  { value: 'system', label: 'System', description: 'Match your device', icon: Monitor },
  { value: 'light', label: 'Light', description: 'Bright and clean', icon: Sun },
  { value: 'dark', label: 'Dark', description: 'Easy on the eyes', icon: Moon },
]

const subscribe = () => () => {}

export function ThemeSelector() {
  const { theme, setTheme } = useTheme()
  const mounted = useSyncExternalStore(subscribe, () => true, () => false)
  const current = mounted ? theme : undefined

  return (
    <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <legend className="sr-only">Theme</legend>
      {THEMES.map(({ value, label, description, icon: Icon }) => {
        const selected = current === value
        return (
          <label
            key={value}
            className={cn(
              'relative flex cursor-pointer flex-col gap-3 rounded-xl border bg-card p-4 text-card-foreground transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
              selected ? 'border-primary' : 'border-border hover:border-muted-foreground/40',
            )}
          >
            <input
              type="radio"
              name="theme"
              value={value}
              checked={selected}
              onChange={() => setTheme(value)}
              className="sr-only"
            />
            <div className="flex items-center justify-between">
              <span className="flex size-9 items-center justify-center rounded-lg bg-muted">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              {selected && (
                <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="size-3" aria-hidden="true" />
                </span>
              )}
            </div>
            <div>
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
          </label>
        )
      })}
    </fieldset>
  )
}
