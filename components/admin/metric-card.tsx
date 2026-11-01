import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

type MetricCardProps = { label: string; value: string; icon: LucideIcon; className?: string; comparison?: string }

export function MetricCard({ label, value, icon: Icon, className, comparison }: MetricCardProps) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-card p-5 text-card-foreground', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="flex items-baseline gap-2">
        <p className="truncate text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
        {comparison && (
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
            {comparison}
          </span>
        )}
      </div>
    </div>
  )
}
