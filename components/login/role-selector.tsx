'use client'

import { motion } from 'framer-motion'
import { ShieldCheck, Store } from 'lucide-react'

export type Role = 'staff' | 'admin'

const options: { value: Role; label: string; hint: string; icon: typeof Store }[] = [
  { value: 'staff', label: 'Staff / Cashier', hint: 'POS terminal', icon: Store },
  { value: 'admin', label: 'Admin', hint: 'Console', icon: ShieldCheck },
]

export function RoleSelector({
  value,
  onChange,
  disabled,
}: {
  value: Role
  onChange: (role: Role) => void
  disabled?: boolean
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Sign in as"
      className="relative grid grid-cols-2 gap-1 rounded-2xl border border-white/10 bg-black/30 p-1"
    >
      {options.map((opt) => {
        const active = value === opt.value
        const Icon = opt.icon
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className="relative flex items-center justify-center gap-2.5 rounded-xl px-3 py-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-orange-400/60 disabled:opacity-60"
          >
            {active && (
              <motion.span
                layoutId="role-pill"
                className="absolute inset-0 rounded-xl border border-orange-400/30 bg-gradient-to-b from-orange-500/25 to-orange-500/10 shadow-[0_0_24px_-6px_rgba(249,115,22,0.6)]"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            <Icon
              className={`relative size-4 transition-colors ${active ? 'text-orange-300' : 'text-slate-500'}`}
              aria-hidden
            />
            <span className="relative flex flex-col items-start leading-tight">
              <span className={active ? 'text-orange-50' : 'text-slate-400'}>{opt.label}</span>
              <span className={`text-[11px] font-normal ${active ? 'text-orange-200/70' : 'text-slate-600'}`}>
                {opt.hint}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
