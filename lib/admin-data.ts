import { supabase } from './supabase'

export type HourlySale = { hour: number; revenue: number }
export type TopMenuItem = { name: string; quantity: number; revenue: number }

export type Transaction = {
  id: string
  orderId: string
  type: string
  paymentMethod: string
  total: number
  time: string
  status: string
}

export type DashboardData = {
  revenueToday: number
  ordersCompleted: number
  signatureItem: string | null
  hourlySales: HourlySale[]
  topItems: TopMenuItem[]
  recentTransactions: Transaction[]
}

const BLOCK_HOURS = Array.from({ length: 8 }, (_, i) => 8 + i * 2)

export const EMPTY_DASHBOARD: DashboardData = {
  revenueToday: 0,
  ordersCompleted: 0,
  signatureItem: null,
  hourlySales: BLOCK_HOURS.map((hour) => ({ hour, revenue: 0 })),
  topItems: [],
  recentTransactions: [],
}

type OrderRow = Record<string, unknown> & {
  id: string
  created_at: string
}

type OrderItemRow = Record<string, unknown>

function orderTotal(order: OrderRow): number {
  const value = order.total_amount ?? order.total ?? order.grand_total ?? 0
  return Number(value) || 0
}

function itemName(item: OrderItemRow): string {
  const value = item.product_name ?? item.name ?? item.title ?? item.item_name
  return typeof value === 'string' && value.trim() ? value : 'Unknown item'
}

function itemQuantity(item: OrderItemRow): number {
  const value = item.quantity ?? item.qty ?? 1
  return Number(value) || 0
}

function itemRevenue(item: OrderItemRow): number {
  const direct = item.total_amount ?? item.subtotal ?? item.total ?? item.total_price
  if (direct != null) return Number(direct) || 0
  const unit = Number(item.unit_price ?? item.price ?? 0) || 0
  return unit * itemQuantity(item)
}

function bucketHour(hour: number): number {
  return Math.min(22, Math.max(8, Math.floor(hour / 2) * 2))
}

function isCompleted(order: OrderRow): boolean {
  const status = order.status ?? order.payment_status
  if (status == null || String(status).trim() === '') return true
  return !/cancel|fail|pending|void/i.test(String(status))
}

function localDateKey(createdAt: string): string {
  const date = new Date(createdAt)
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function formatTime(createdAt: string): string {
  return new Date(createdAt).toLocaleTimeString('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function toTransaction(order: OrderRow): Transaction {
  const rawStatus = order.status ?? order.payment_status
  const status = rawStatus == null || String(rawStatus).trim() === ''
    ? 'Completed'
    : String(rawStatus)
  return {
    id: String(order.id),
    orderId: String(order.order_number ?? order.id),
    type: String(order.order_type ?? order.type ?? '—'),
    paymentMethod: String(order.payment_method ?? order.method ?? '—'),
    total: orderTotal(order),
    time: formatTime(order.created_at),
    status: status.charAt(0).toUpperCase() + status.slice(1).toLowerCase(),
  }
}

export async function getDashboardData(): Promise<DashboardData> {
  // Fetch all orders (no date filters) so Recent Transactions and the
  // Sales Trend graph refresh instantly for any new transaction.
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })

  if (ordersError) {
    console.error('Error fetching orders:', ordersError)
    return EMPTY_DASHBOARD
  }

  const allOrders = (orders ?? []) as OrderRow[]
  const recentTransactions: Transaction[] = allOrders.slice(0, 10).map(toTransaction)

  // Metrics + graph focus on today's completed orders; if none exist yet,
  // fall back to the most recent day present so the chart still renders.
  const completedOrders = allOrders.filter(isCompleted)
  const todayKey = localDateKey(new Date().toISOString())
  let focusOrders = completedOrders.filter((order) => localDateKey(order.created_at) === todayKey)
  if (focusOrders.length === 0 && completedOrders.length > 0) {
    const latestKey = localDateKey(completedOrders[0].created_at)
    focusOrders = completedOrders.filter((order) => localDateKey(order.created_at) === latestKey)
  }

  const revenueToday = focusOrders.reduce((sum, order) => sum + orderTotal(order), 0)

  let items: OrderItemRow[] = []
  if (focusOrders.length > 0) {
    const { data: orderItems, error: itemsError } = await supabase
      .from('order_items')
      .select('*')
      .in(
        'order_id',
        focusOrders.map((order) => order.id)
      )

    if (itemsError) {
      console.error('Error fetching order items:', itemsError)
    } else {
      items = orderItems ?? []
    }
  }

  const totalsByName = new Map<string, { quantity: number; revenue: number }>()
  for (const item of items) {
    const name = itemName(item)
    const quantity = itemQuantity(item)
    const revenue = itemRevenue(item)
    const entry = totalsByName.get(name) ?? { quantity: 0, revenue: 0 }
    entry.quantity += quantity
    entry.revenue += revenue
    totalsByName.set(name, entry)
  }

  const topItems: TopMenuItem[] = [...totalsByName.entries()]
    .map(([name, { quantity, revenue }]) => ({ name, quantity, revenue }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5)

  const revenueByHour = new Map<number, number>(BLOCK_HOURS.map((hour) => [hour, 0]))
  for (const order of focusOrders) {
    const hour = bucketHour(new Date(order.created_at).getHours())
    revenueByHour.set(hour, (revenueByHour.get(hour) ?? 0) + orderTotal(order))
  }

  return {
    revenueToday,
    ordersCompleted: focusOrders.length,
    signatureItem: topItems[0]?.name ?? null,
    hourlySales: BLOCK_HOURS.map((hour) => ({ hour, revenue: revenueByHour.get(hour) ?? 0 })),
    topItems,
    recentTransactions,
  }
}

export function formatHour(hour: number) {
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const display = hour % 12 === 0 ? 12 : hour % 12
  return `${display}${suffix}`
}
