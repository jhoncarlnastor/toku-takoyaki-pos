'use client'

import { useId, useState, type ReactNode } from 'react'
import { Eye, EyeOff } from 'lucide-react'

type TextFieldProps = {
  label: string
  type: 'email' | 'password'
  icon: ReactNode
  value: string
  onChange: (value: string) => void
  placeholder?: string
  autoComplete?: string
  invalid?: boolean
  disabled?: boolean
  trailing?: ReactNode
}

export function TextField({
  label,
  type,
  icon,
  value,
  onChange,
  placeholder,
  autoComplete,
  invalid,
  disabled,
  trailing,
}: TextFieldProps) {
  const id = useId()
  const [visible, setVisible] = useState(false)
  const isPassword = type === 'password'

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-sm font-medium text-slate-300">
          {label}
        </label>
        {trailing}
      </div>
      <div
        className={`group flex items-center gap-3 rounded-xl border bg-zinc-900/80 px-4 transition-all duration-200 focus-within:bg-zinc-900 focus-within:ring-1 ${
          invalid
            ? 'border-red-500/50 focus-within:border-red-400 focus-within:ring-red-500'
            : 'border-zinc-800 hover:border-zinc-700 focus-within:border-orange-500 focus-within:ring-orange-500'
        }`}
      >
        <span className="text-slate-500 transition-colors group-focus-within:text-orange-400" aria-hidden>
          {icon}
        </span>
        <input
          id={id}
          type={isPassword && visible ? 'text' : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          className="h-13 w-full bg-zinc-900/80 text-[15px] text-white outline-none placeholder:text-slate-600 disabled:opacity-60"
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Hide password' : 'Show password'}
            aria-pressed={visible}
            className="-mr-2 rounded-lg p-2 text-slate-500 outline-none transition-colors hover:text-orange-300 focus-visible:ring-2 focus-visible:ring-orange-400/60"
          >
            {visible ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
          </button>
        )}
      </div>
    </div>
  )
}
