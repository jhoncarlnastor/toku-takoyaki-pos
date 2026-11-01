'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Radio, Receipt } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatPeso } from '@/lib/currency'

type Order = {
  id: string
  order_number: string
  order_type: string
  subtotal: number | null
  total_amount: number
  payment_method: string | null
  status: string | null
  created_at: string
}

type OrderItemRow = {
  id: string
  order_id: string
  product_id: string | null
  product_name: string
  quantity: number
  unit_price: number
  total_price: number
}

type AddOnLine = { name: string; quantity: number; unitPrice: number }

type ReceiptLine = {
  key: string
  name: string
  quantity: number
  unitPrice: number
  totalPrice: number
  addOns: AddOnLine[]
}

const ACTIVE_WINDOW_MINUTES = 30

const FLOATING_FOODS = ['🍤', '🍢', '🥢', '🍜', '🍥', '🧡']

function orderLabel(order: Order) {
  const n = String(order.order_number ?? '').trim()
  return n.startsWith('#') ? `Order ${n}` : `Order #${n}`
}

function statusBadge(status: string | null) {
  const s = (status ?? '').toLowerCase()
  if (s.includes('cancel') || s.includes('void') || s.includes('fail')) {
    return { label: 'Cancelled', className: 'border-red-500/40 bg-red-500/15 text-red-400', live: false }
  }
  if (s.includes('complete') || s === 'done') {
    return { label: 'Completed', className: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400', live: false }
  }
  if (s.includes('paid') || s.includes('payment received')) {
    return { label: 'Payment Received', className: 'border-sky-500/40 bg-sky-500/15 text-sky-400', live: true }
  }
  return { label: 'Preparing Order', className: 'border-amber-500/40 bg-amber-500/15 text-amber-400', live: true }
}

function buildLines(rows: OrderItemRow[]): ReceiptLine[] {
  const lines: ReceiptLine[] = []
  for (const row of rows) {
    if (row.product_id === null) {
      const addOn: AddOnLine = { name: row.product_name, quantity: row.quantity, unitPrice: row.unit_price }
      if (lines.length > 0) {
        lines[lines.length - 1].addOns.push(addOn)
      } else {
        lines.push({
          key: row.id,
          name: row.product_name,
          quantity: row.quantity,
          unitPrice: row.unit_price,
          totalPrice: row.total_price,
          addOns: [],
        })
      }
    } else {
      lines.push({
        key: row.id,
        name: row.product_name,
        quantity: row.quantity,
        unitPrice: row.unit_price,
        totalPrice: row.total_price,
        addOns: [],
      })
    }
  }
  return lines
}

function isActiveOrder(order: Order): boolean {
  const status = (order.status ?? '').toLowerCase()
  if (status.includes('cancel') || status.includes('void') || status.includes('fail')) return false
  const ageMs = Date.now() - new Date(order.created_at).getTime()
  return ageMs <= ACTIVE_WINDOW_MINUTES * 60 * 1000
}

/* ============================ PANES ============================ */

const SLOGANS = [
  "Fresh, Hot, and Authentic Japanese Takoyaki",
  "Made Fresh Upon Every Order",
  "Crispy Outside, Soft Inside"
]

function BrandingHero() {
  const [sloganIndex, setSloganIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setSloganIndex((i) => (i + 1) % SLOGANS.length), 3000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="relative flex flex-col items-center justify-center gap-6 rounded-3xl border border-white/5 bg-[#181a24] p-8 text-center shadow-2xl">
      <div className="relative w-28 h-28 rounded-full border-2 border-rose-500/40 p-2 shadow-xl shadow-rose-950/40 animate-pulse">
         <Image src="/toku-logo.png" alt="Toku Takoyaki" width={100} height={100} className="rounded-full object-cover" priority />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        <h2 className="text-3xl font-extrabold text-white">Thank you for dining with Toku Takoyaki!</h2>
      </motion.div>

      <div className="h-8">
        <AnimatePresence mode="wait">
          <motion.p
            key={sloganIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-lg font-medium text-zinc-400"
          >
            {SLOGANS[sloganIndex]}
          </motion.p>
        </AnimatePresence>
      </div>

      <div className="mt-4 rounded-full bg-zinc-800/50 px-4 py-2 text-sm text-zinc-300 border border-white/5">
        Please verify your order details on the right screen.
      </div>
    </div>
  )
}

function StatusBadge({ status, className }: { status: string | null; className?: string }) {
  const badge = statusBadge(status)
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold sm:text-sm ${badge.className} ${className ?? ''}`}
    >
      {badge.live && (
        <span className="relative flex size-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
          <span className="relative inline-flex size-2 rounded-full bg-current" />
        </span>
      )}
      {badge.label}
    </span>
  )
}

function ActiveOrderSummary({ order, itemCount }: { order: Order; itemCount: number }) {
  return (
    <div className="rounded-3xl border border-[#2a2d3d] bg-[#181a24] p-5 sm:p-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[#94a3b8]">Now Serving</h2>
        <StatusBadge status={order.status} />
      </div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-3xl font-extrabold tracking-tight text-[#f97316] sm:text-4xl">
            {orderLabel(order)}
          </p>
          <p className="mt-1 text-sm text-[#94a3b8]">
            {itemCount} {itemCount === 1 ? 'item' : 'items'} · {order.order_type}
            {order.payment_method ? ` · ${order.payment_method}` : ''}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-[#94a3b8]">Total</p>
          <p className="text-2xl font-bold tabular-nums sm:text-3xl">{formatPeso(order.total_amount)}</p>
        </div>
      </div>
    </div>
  )
}

function ReceiptPane({ order, lines }: { order: Order; lines: ReceiptLine[] }) {
  const subtotal = order.subtotal ?? order.total_amount
  const taxDiscount = order.total_amount - subtotal

  return (
    <div className="flex h-full flex-col rounded-3xl border border-[#2a2d3d] bg-[#181a24] shadow-2xl">
      <div className="flex items-center justify-between border-b border-[#2a2d3d] px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-xl bg-[#f97316]/15 text-[#f97316]">
            <Receipt className="size-5" aria-hidden />
          </span>
          <div>
            <p className="text-xs uppercase tracking-widest text-[#94a3b8]">Receipt</p>
            <p className="text-lg font-bold leading-tight">{orderLabel(order)}</p>
          </div>
        </div>
        <div className="hidden text-right sm:block">
          <p className="text-xs text-[#94a3b8]">Placed at</p>
          <p className="text-sm font-semibold tabular-nums">
            {new Date(order.created_at).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
        {lines.length === 0 ? (
          <p className="py-8 text-center text-sm text-[#64748b]">Loading items…</p>
        ) : (
          <ul className="space-y-4">
            {lines.map((line) => (
              <li key={line.key}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold leading-snug">
                      {line.name} <span className="text-[#94a3b8]">×{line.quantity}</span>
                    </p>
                    <p className="text-xs tabular-nums text-[#64748b]">
                      {formatPeso(line.unitPrice)} each
                    </p>
                  </div>
                  <p className="shrink-0 font-semibold tabular-nums">{formatPeso(line.totalPrice)}</p>
                </div>
                {line.addOns.length > 0 && (
                  <ul className="ml-4 mt-1.5 space-y-1 border-l border-[#2a2d3d] pl-3">
                    {line.addOns.map((addOn, i) => (
                      <li key={`${line.key}-addon-${i}`} className="flex items-center justify-between gap-3 text-sm text-[#94a3b8]">
                        <span>
                          <span className="text-[#f97316]">+</span> {addOn.name}{' '}
                          <span className="text-[#64748b]">×{addOn.quantity}</span>
                        </span>
                        <span className="tabular-nums">{formatPeso(addOn.unitPrice * addOn.quantity)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-[#2a2d3d] px-5 py-4 sm:px-6">
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between text-[#94a3b8]">
            <span>Subtotal</span>
            <span className="tabular-nums">{formatPeso(subtotal)}</span>
          </div>
          <div className="flex justify-between text-[#94a3b8]">
            <span>Tax / Discount</span>
            <span className="tabular-nums">
              {taxDiscount < 0 ? `-${formatPeso(Math.abs(taxDiscount))}` : formatPeso(taxDiscount)}
            </span>
          </div>
          <div className="flex items-baseline justify-between border-t border-dashed border-[#2a2d3d] pt-2.5 text-base font-bold">
            <span>Total</span>
            <span className="text-xl tabular-nums text-[#f97316]">{formatPeso(order.total_amount)}</span>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-[#2a2d3d] bg-[#0f1117] px-4 py-3">
          <div>
            <p className="text-xs text-[#64748b]">Payment Status</p>
            <p className="text-sm font-semibold">{order.payment_method ?? 'At counter'}</p>
          </div>
          <StatusBadge status={order.status} />
        </div>
      </div>
    </div>
  )
}

function StandbyScreen() {
  const reduce = useReducedMotion()
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-6 overflow-hidden px-6 text-center">
      {!reduce &&
        FLOATING_FOODS.map((food, i) => (
          <motion.span
            key={`${food}-${i}`}
            className="pointer-events-none absolute text-4xl opacity-20 sm:text-5xl"
            style={{ left: `${8 + i * 16}%`, top: `${18 + ((i * 27) % 55)}%` }}
            animate={{ y: [0, -22, 0], rotate: [0, i % 2 === 0 ? 8 : -8, 0] }}
            transition={{ duration: 5 + i, repeat: Infinity, ease: 'easeInOut', delay: i * 0.6 }}
            aria-hidden
          >
            {food}
          </motion.span>
        ))}

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 flex flex-col items-center gap-4"
      >
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-[#f97316]/40 blur-2xl" aria-hidden />
          <Image
            src="/toku-logo.png"
            alt="Toku Takoyaki"
            width={112}
            height={112}
            priority
            className="relative h-24 w-24 rounded-full border-[3px] border-[#f97316]/40 object-cover shadow-[0_0_50px_rgba(249,115,22,0.35)] sm:h-28 sm:w-28"
          />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
          Welcome to Toku Takoyaki!
        </h1>
        <p className="max-w-xl text-base text-[#94a3b8] sm:text-xl">
          Please place your order at the counter.
        </p>
        <motion.p
          className="mt-2 text-xs uppercase tracking-[0.4em] text-[#64748b]"
          animate={reduce ? undefined : { opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        >
          Fresh · Hot · Crispy
        </motion.p>
      </motion.div>
    </div>
  )
}

/* ============================ PAGE ============================ */

export default function CustomerViewPage() {
  const [order, setOrder] = useState<Order | null>(null)
  const [lines, setLines] = useState<ReceiptLine[]>([])
  const [liveAt, setLiveAt] = useState<Date>(new Date())
  const [realtimeOn, setRealtimeOn] = useState(false)
  const [cartData, setCartData] = useState<any | null>(null)

  // Force reset all customer view state to idle/welcome screen
  const clearDisplay = useCallback(() => {
    setOrder(null)
    setLines([])
    setCartData(null)
    setLiveAt(new Date())
  }, [])

  // Listen to BroadcastChannel from POS
  useEffect(() => {
    const customerChannel = new BroadcastChannel('toku_customer_display')
    customerChannel.onmessage = (event) => {
      if (event.data.type === 'SYNC_CART') {
        if (event.data.cart && event.data.cart.length > 0) {
          setCartData(event.data)
        } else {
          clearDisplay()
        }
      } else if (event.data.type === 'CLEAR_CUSTOMER_VIEW') {
        clearDisplay()
      }
    }
    return () => customerChannel.close()
  }, [clearDisplay])

  // Listen to localStorage for cross-tab synchronization (fallback)
  useEffect(() => {
    // Initialize from localStorage on mount
    const stored = localStorage.getItem('toku_pos_cart')
    if (stored) {
      try {
        const data = JSON.parse(stored)
        if (data && data.cart && data.cart.length > 0) {
          setCartData(data)
        } else {
          clearDisplay()
        }
      } catch {}
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'toku_pos_cart') {
        if (e.newValue) {
          try {
            const data = JSON.parse(e.newValue)
            if (data && data.cart && data.cart.length > 0) {
              setCartData(data)
            } else {
              clearDisplay()
            }
          } catch {}
        } else {
          // localStorage item was removed (cleared)
          clearDisplay()
        }
      }
      // NEW: Listen for explicit customer view clear signal
      if (e.key === 'toku_customer_view_cleared') {
        if (e.newValue) {
          clearDisplay()
        }
      }
    }

    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [clearDisplay])

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)

    if (error) {
      console.error('Customer view orders error:', error)
      setOrder(null)
      setLines([])
      return
    }

    const latest = (data?.[0] as Order | undefined) ?? null
    const active = latest && isActiveOrder(latest) ? latest : null
    setOrder(active)
    setLiveAt(new Date())

    if (!active) {
      setLines([])
      return
    }

    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', active.id)

    if (itemsError) {
      console.error('Customer view items error:', itemsError)
      setLines([])
      return
    }
    setLines(buildLines((items as OrderItemRow[]) ?? []))
  }, [])

  useEffect(() => {
    load()

    // Realtime: cashier updates in /pos reflect here instantly
    const channel = supabase
      .channel('customer_view_display')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        load()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => {
        load()
      })
      .on('broadcast', { event: 'CLEAR_CUSTOMER_VIEW' }, () => {
        clearDisplay()
      })
      .subscribe((status) => {
        setRealtimeOn(status === 'SUBSCRIBED')
      })

    // Fallback poll in case realtime drops
    const timer = setInterval(load, 30_000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(timer)
    }
  }, [load])

  // Determine active display data
  const hasCart = cartData && cartData.cart && cartData.cart.length > 0;
  const activeOrderNum = cartData?.orderNumber ?? order?.order_number ?? "----";
  const activeOrderType = cartData?.orderType ?? order?.order_type ?? "Dine-in";
  const activeTotal = cartData?.total ?? order?.total_amount ?? 0;
  const cashTendered = cartData?.cashTendered ?? 0;
  const changeDue = cartData?.changeDue ?? 0;

  // Standby State (When cart.length === 0 and no active order)
  if (!hasCart && !order) {
    return (
      <main className="min-h-screen bg-[#121318] text-zinc-100 font-sans flex items-center justify-center">
        <StandbyScreen />
      </main>
    )
  }

  // Active Order State (When cart.length > 0 or active order exists)
  return (
    <div className="w-full h-screen p-6 bg-[#121318] flex flex-col justify-between text-zinc-100 font-sans overflow-hidden">
      {/* Top Header */}
      <header className="flex items-center justify-between border-b border-white/10 pb-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative h-12 w-12 overflow-hidden rounded-full border-2 border-rose-500/40 shadow-md">
            <Image src="/toku-logo.png" alt="Toku Takoyaki" width={48} height={48} className="object-cover h-full w-full" priority />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold tracking-tight text-white">Toku Takoyaki</h1>
              <span className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-sm font-semibold text-rose-400">
                Order #{activeOrderNum} ({activeOrderType})
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">Live Customer Receipt Display</p>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#1a1c23] px-4 py-2 font-mono text-sm text-zinc-300 shadow-sm">
          <span className={`size-2.5 rounded-full ${realtimeOn ? 'bg-emerald-400' : 'bg-amber-400'}`} />
          {liveAt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: '2-digit', year: 'numeric' })} • {liveAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })}
        </div>
      </header>

      {/* Order Items (Middle Section) */}
      <div className="flex-1 space-y-4 my-6 overflow-y-auto pr-2 bg-[#1a1c23]/60 border border-white/5 rounded-3xl p-6 shadow-inner min-h-0">
        <div className="divide-y divide-white/5">
          {hasCart ? (
            cartData.cart.map((line: any, index: number) => {
              const addOnsTotal = line.addOns?.reduce((s: number, a: any) => s + a.price, 0) || 0;
              const unitPrice = line.item.price + addOnsTotal;
              const lineTotal = unitPrice * line.qty;
              return (
                <div key={index} className="py-4 flex items-center justify-between gap-4 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-xl font-bold text-white mb-0.5">{line.item.name}</p>
                    <p className="text-sm text-zinc-400 font-medium">Qty: {line.qty} × ₱{unitPrice.toFixed(2)}</p>
                    {line.addOns && line.addOns.length > 0 && (
                      <p className="text-xs text-rose-400 mt-1 font-medium">
                        + {line.addOns.map((a: any) => `${a.name} (₱${a.price})`).join(', ')}
                      </p>
                    )}
                  </div>
                  <p className="text-xl font-bold text-rose-400 tabular-nums">₱{lineTotal.toFixed(2)}</p>
                </div>
              );
            })
          ) : (
            lines.map((line) => (
              <div key={line.key} className="py-4 flex items-center justify-between gap-4 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <p className="text-xl font-bold text-white mb-0.5">{line.name}</p>
                  <p className="text-sm text-zinc-400 font-medium">Qty: {line.quantity} × ₱{line.unitPrice.toFixed(2)}</p>
                  {line.addOns && line.addOns.length > 0 && (
                    <p className="text-xs text-rose-400 mt-1 font-medium">
                      + {line.addOns.map((a) => `${a.name} (₱${a.unitPrice})`).join(', ')}
                    </p>
                  )}
                </div>
                <p className="text-xl font-bold text-rose-400 tabular-nums">₱{line.totalPrice.toFixed(2)}</p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Footer Payment Section (Total, Cash & Change) */}
      <footer className="shrink-0 grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
        {/* Total Amount */}
        <div className="rounded-2xl border border-white/5 bg-[#1a1c23] p-5 flex flex-col justify-between shadow-md">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Total Amount</span>
          <span className="text-3xl font-extrabold text-rose-500 tabular-nums mt-2">₱{activeTotal.toFixed(2)}</span>
        </div>

        {/* Cash Received */}
        <div className="rounded-2xl border border-white/5 bg-[#1a1c23] p-5 flex flex-col justify-between shadow-md">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Cash Received</span>
          <span className="text-2xl font-bold text-zinc-300 tabular-nums mt-2">₱{cashTendered.toFixed(2)}</span>
        </div>

        {/* Change Due */}
        <div className="rounded-2xl border border-white/5 bg-[#1a1c23] p-5 flex flex-col justify-between shadow-md">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Change Due</span>
          <span className="text-3xl font-extrabold text-emerald-400 tabular-nums mt-2">₱{changeDue.toFixed(2)}</span>
        </div>
      </footer>
    </div>
  )
}
