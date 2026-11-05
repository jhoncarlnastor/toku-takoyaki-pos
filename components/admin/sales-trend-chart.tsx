'use client'

import {
  Area,
  AreaChart,
  CartesianGrid,
  Dot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { type TrendPoint } from '@/lib/admin-data'
import { formatPeso } from '@/lib/currency'

type SalesTooltipProps = {
  active?: boolean
  payload?: Array<{ payload: TrendPoint }>
}

function SalesTooltip({ active, payload }: SalesTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  const { label, revenue } = payload[0].payload
  return (
    <div className="rounded-lg border border-[#2a2d3d] bg-[#121318] px-3 py-2 text-xs font-semibold text-white shadow-xl">
      {label} | Sales: {formatPeso(revenue)}
    </div>
  )
}

export function SalesTrendChart({
  data,
  caption,
}: {
  data: TrendPoint[]
  caption?: string
}) {
  const max = Math.max(0, ...data.map((d) => d.revenue))
  const hasData = max > 0

  return (
    <section aria-labelledby="sales-trend-heading" className="flex flex-col rounded-xl border border-border bg-card p-5 text-card-foreground">
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <h2 id="sales-trend-heading" className="text-sm font-semibold">
          Sales Trend
        </h2>
        <span className="text-xs text-muted-foreground">{caption ?? 'Sales trend'}</span>
      </div>

      <div className="relative h-52">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="roseGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#e11d48" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#e11d48" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />

            <XAxis
              dataKey="label"
              tick={{ fill: '#64748b', fontSize: 10 }}
              axisLine={{ stroke: '#1e293b' }}
              tickLine={false}
              interval={data.length > 10 ? 'preserveStartEnd' : 0}
              minTickGap={8}
            />
            <YAxis
              width={56}
              tickFormatter={(value: number) => `₱${value.toLocaleString('en-PH')}`}
              tick={{ fill: '#64748b', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              domain={[0, 'auto']}
            />

            <Tooltip
              content={<SalesTooltip />}
              cursor={{ stroke: '#e11d48', strokeWidth: 2, strokeDasharray: '4 4' }}
            />

            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#e11d48"
              strokeWidth={3}
              fill="url(#roseGradient)"
              dot={<Dot r={3.5} fill="#e11d48" stroke="#0f1117" strokeWidth={2} className="drop-shadow-[0_0_4px_rgba(225,29,72,0.8)]" />}
              activeDot={
                <Dot
                  r={4}
                  fill="#e11d48"
                  stroke="#0f1117"
                  strokeWidth={2}
                  className="drop-shadow-[0_0_8px_rgba(225,29,72,0.95)]"
                />
              }
            />
          </AreaChart>
        </ResponsiveContainer>

        {!hasData && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            No sales recorded for this period
          </p>
        )}
      </div>
    </section>
  )
}
