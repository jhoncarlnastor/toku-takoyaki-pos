import type { TopMenuItem } from '@/lib/admin-data'
import { formatPeso } from '@/lib/currency'

export function TopMenuItems({ items }: { items: TopMenuItem[] }) {
  return (
    <section aria-labelledby="top-items-heading" className="flex flex-col rounded-xl border border-border bg-card p-5 text-card-foreground">
      <h2 id="top-items-heading" className="mb-4 text-sm font-semibold">
        Top Menu Items
      </h2>

      {items.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border py-12">
          <p className="text-sm text-muted-foreground">No items sold yet</p>
        </div>
      ) : (
        <ol className="flex flex-col divide-y divide-border">
          {items.map((item, index) => (
            <li key={item.name} className="flex items-center gap-3 py-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.name}</p>
                <p className="text-xs text-muted-foreground tabular-nums">{item.quantity} sold</p>
              </div>
              <span className="text-sm font-medium tabular-nums">{formatPeso(item.revenue)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
