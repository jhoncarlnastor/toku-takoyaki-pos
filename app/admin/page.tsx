'use client'

import { useCallback, useEffect, useState } from 'react'
import { Banknote, CheckCircle2, Download, Star } from 'lucide-react'
import { MetricCard } from '@/components/admin/metric-card'
import { PageHeader } from '@/components/admin/page-header'
import { SalesTrendChart } from '@/components/admin/sales-trend-chart'
import { TopMenuItems } from '@/components/admin/top-menu-items'
import { Button } from '@/components/ui/button'
import {
  DATE_RANGE_OPTIONS,
  EMPTY_DASHBOARD,
  dateRangeLabel,
  getDashboardData,
  getSalesReportRows,
  salesReportToCsv,
  type DashboardData,
  type DateRangeKey,
} from '@/lib/admin-data'
import { formatPeso } from '@/lib/currency'
import { supabase } from '@/lib/supabase'

export default function DashboardOverviewPage() {
  const [data, setData] = useState<DashboardData>(EMPTY_DASHBOARD)
  const [dateRange, setDateRange] = useState<DateRangeKey>('today')
  const [exporting, setExporting] = useState(false)

  const fetchDashboardData = useCallback(async () => {
    const next = await getDashboardData(dateRange)
    setData(next)
  }, [dateRange])

  useEffect(() => {
    fetchDashboardData()

    const channel = supabase
      .channel('dashboard_updates')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        () => {
          fetchDashboardData()
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        () => {
          fetchDashboardData()
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'order_items' },
        () => {
          fetchDashboardData()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchDashboardData])

  const handleExport = async () => {
    setExporting(true)
    try {
      const rows = await getSalesReportRows(dateRange)
      const csv = salesReportToCsv(rows)
      // BOM so Excel detects UTF-8 correctly
      const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = 'sales-report.csv'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to export sales report:', error)
    } finally {
      setExporting(false)
    }
  }

  const rangeLabel = dateRangeLabel(dateRange)

  return (
    <>
      <PageHeader
        title="Dashboard Overview"
        description={`${rangeLabel} performance at a glance.`}
        actions={
          <>
            <label className="sr-only" htmlFor="dashboard-date-range">
              Date range
            </label>
            <select
              id="dashboard-date-range"
              value={dateRange}
              onChange={(event) => setDateRange(event.target.value as DateRangeKey)}
              className="h-8 rounded-lg border border-border bg-background px-2.5 text-sm font-medium text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {DATE_RANGE_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
            <Button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              aria-label="Export Sales Report"
            >
              <Download />
              {exporting ? 'Exporting…' : 'Export Sales Report'}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          label={`Total Revenue · ${rangeLabel}`}
          value={formatPeso(data.revenue)}
          icon={Banknote}
          comparison={rangeLabel}
        />
        <MetricCard
          label="Orders Completed"
          value={data.ordersCompleted.toLocaleString('en-PH')}
          icon={CheckCircle2}
          comparison={rangeLabel}
        />
        <MetricCard
          label="Signature Item"
          value={data.signatureItem ?? '—'}
          icon={Star}
          className="sm:col-span-2 lg:col-span-1"
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SalesTrendChart data={data.salesTrend} caption={data.trendCaption} />
        </div>
        <TopMenuItems items={data.topItems} />
      </div>

      <section aria-labelledby="recent-transactions-heading" className="mt-4 flex flex-col rounded-xl border border-border bg-card p-5 text-card-foreground">
        <div className="mb-4 flex items-baseline justify-between gap-2">
          <h2 id="recent-transactions-heading" className="text-sm font-semibold">
            Recent Transactions
          </h2>
          <span className="text-xs text-muted-foreground">Latest 10 orders</span>
        </div>

        {data.recentTransactions.length === 0 ? (
          <div className="flex items-center justify-center rounded-lg border border-dashed border-border py-10">
            <p className="text-sm text-muted-foreground">No transactions yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2.5 font-medium">Order ID</th>
                  <th className="px-3 py-2.5 font-medium">Type</th>
                  <th className="px-3 py-2.5 font-medium">Payment Method</th>
                  <th className="px-3 py-2.5 text-right font-medium">Total Amount</th>
                  <th className="px-3 py-2.5 font-medium">Time</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.recentTransactions.map((transaction) => (
                  <tr key={transaction.id} className="transition-colors hover:bg-slate-800/50">
                    <td className="max-w-[140px] truncate px-3 py-2.5 font-medium tabular-nums" title={transaction.id}>
                      #{transaction.orderId}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                        {transaction.type}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                        {transaction.paymentMethod}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium tabular-nums">
                      {formatPeso(transaction.total)}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                      {transaction.time}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${
                          transaction.status === 'Completed'
                            ? 'bg-emerald-500/20 text-emerald-400 ring-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.45)]'
                            : 'bg-muted text-muted-foreground ring-border'
                        }`}
                      >
                        {transaction.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
