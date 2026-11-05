import { supabase } from './supabase'

export type TrendPoint = { label: string; revenue: number }
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

export type DateRangeKey = 'today' | 'yesterday' | 'last7' | 'thisMonth' | 'all'

export const DATE_RANGE_OPTIONS: { key: DateRangeKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'last7', label: 'Last 7 Days' },
  { key: 'thisMonth', label: 'This Month' },
  { key: 'all', label: 'All Time' },
]

export function dateRangeLabel(key: DateRangeKey): string {
  return DATE_RANGE_OPTIONS.find((option) => option.key === key)?.label ?? 'All Time'
}

export type DashboardData = {
  revenue: number
  ordersCompleted: number
  signatureItem: string | null
  salesTrend: TrendPoint[]
  trendCaption: string
  topItems: TopMenuItem[]
  recentTransactions: Transaction[]
}

const BLOCK_HOURS = Array.from({ length: 8 }, (_, i) => 8 + i * 2)
const ADDON_PRICE_THRESHOLD = 20

export const EMPTY_DASHBOARD: DashboardData = {
  revenue: 0,
  ordersCompleted: 0,
  signatureItem: null,
  salesTrend: [],
  trendCaption: '',
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

function statusLabel(order: OrderRow): string {
  const rawStatus = order.status ?? order.payment_status
  if (rawStatus == null || String(rawStatus).trim() === '') return 'Completed'
  const status = String(rawStatus)
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
}

function localDateKey(createdAt: string): string {
  const date = new Date(createdAt)
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function formatTime(createdAt: string): string {
  return new Date(createdAt).toLocaleTimeString('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function formatDateTime(createdAt: string): string {
  return new Date(createdAt).toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function toTransaction(order: OrderRow): Transaction {
  return {
    id: String(order.id),
    orderId: String(order.order_number ?? order.id),
    type: String(order.order_type ?? order.type ?? '—'),
    paymentMethod: String(order.payment_method ?? order.method ?? '—'),
    total: orderTotal(order),
    time: formatTime(order.created_at),
    status: statusLabel(order),
  }
}

export type DateRangeBounds = { start: Date | null; end: Date | null }

export function getDateRangeBounds(key: DateRangeKey): DateRangeBounds {
  const now = new Date()
  const today = startOfDay(now)

  switch (key) {
    case 'today':
      return { start: today, end: null }
    case 'yesterday': {
      const start = new Date(today)
      start.setDate(start.getDate() - 1)
      return { start, end: today }
    }
    case 'last7': {
      const start = new Date(today)
      start.setDate(start.getDate() - 6)
      return { start, end: null }
    }
    case 'thisMonth':
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: null }
    case 'all':
    default:
      return { start: null, end: null }
  }
}

function withinRange(createdAt: string, bounds: DateRangeBounds): boolean {
  const timestamp = new Date(createdAt).getTime()
  if (bounds.start && timestamp < bounds.start.getTime()) return false
  if (bounds.end && timestamp >= bounds.end.getTime()) return false
  return true
}

// Add-on rows are saved with product_id: null and tiny prices (P5-P10).
// Real menu mains are always P39+ with a product_id, so this never hides one.
export function isAddOnRow(item: OrderItemRow): boolean {
  const productId = item.product_id
  if (productId == null || productId === '') return true
  const price = Number(item.unit_price ?? item.price ?? 0)
  if (price > 0 && price <= ADDON_PRICE_THRESHOLD) return true
  return false
}

function buildHourlyTrend(orders: OrderRow[]): TrendPoint[] {
  const revenueByHour = new Map<number, number>(BLOCK_HOURS.map((hour) => [hour, 0]))
  for (const order of orders) {
    const hour = bucketHour(new Date(order.created_at).getHours())
    revenueByHour.set(hour, (revenueByHour.get(hour) ?? 0) + orderTotal(order))
  }
  return BLOCK_HOURS.map((hour) => ({
    label: formatHour(hour),
    revenue: revenueByHour.get(hour) ?? 0,
  }))
}

function buildDailyTrend(orders: OrderRow[], bounds: DateRangeBounds): TrendPoint[] {
  const revenueByDay = new Map<string, number>()
  let earliest = Number.POSITIVE_INFINITY

  for (const order of orders) {
    const key = localDateKey(order.created_at)
    revenueByDay.set(key, (revenueByDay.get(key) ?? 0) + orderTotal(order))
    earliest = Math.min(earliest, new Date(order.created_at).getTime())
  }

  const rangeEnd = bounds.end ? new Date(bounds.end.getTime() - 1) : new Date()
  let cursor: Date
  if (bounds.start) cursor = startOfDay(bounds.start)
  else if (Number.isFinite(earliest)) cursor = startOfDay(new Date(earliest))
  else return []

  const lastDay = startOfDay(rangeEnd)
  const points: TrendPoint[] = []
  while (cursor <= lastDay) {
    const key = `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`
    points.push({
      label: cursor.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }),
      revenue: revenueByDay.get(key) ?? 0,
    })
    cursor.setDate(cursor.getDate() + 1)
    if (points.length > 400) break // safety cap for very old datasets
  }
  return points
}

function buildSalesTrend(orders: OrderRow[], range: DateRangeKey, bounds: DateRangeBounds): TrendPoint[] {
  if (range === 'today' || range === 'yesterday') return buildHourlyTrend(orders)
  return buildDailyTrend(orders, bounds)
}

function trendCaptionFor(range: DateRangeKey): string {
  const label = dateRangeLabel(range)
  return range === 'today' || range === 'yesterday'
    ? `2-hour blocks · ${label}`
    : `Daily · ${label}`
}

async function fetchOrderItems(orderIds: string[]): Promise<OrderItemRow[]> {
  if (orderIds.length === 0) return []
  const { data, error } = await supabase.from('order_items').select('*').in('order_id', orderIds)
  if (error) {
    console.error('Error fetching order items:', error)
    return []
  }
  return (data ?? []) as OrderItemRow[]
}

export async function getDashboardData(range: DateRangeKey = 'today'): Promise<DashboardData> {
  // Fetch all orders (no server-side date filter) so Recent Transactions stay
  // instant and the realtime subscription keeps working for any range.
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

  const bounds = getDateRangeBounds(range)
  const rangeOrders = allOrders.filter((order) => withinRange(order.created_at, bounds))
  const completedOrders = rangeOrders.filter(isCompleted)

  const revenue = completedOrders.reduce((sum, order) => sum + orderTotal(order), 0)

  const items = await fetchOrderItems(completedOrders.map((order) => order.id))

  // Top menu items: MAIN PRODUCTS ONLY — add-on rows (cheese, spicy sauce,
  // nata, cream cheese, …) are filtered out before ranking.
  const totalsByName = new Map<string, { quantity: number; revenue: number }>()
  for (const item of items) {
    if (isAddOnRow(item)) continue
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
    .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
    .slice(0, 5)

  return {
    revenue,
    ordersCompleted: completedOrders.length,
    signatureItem: topItems[0]?.name ?? null,
    salesTrend: buildSalesTrend(completedOrders, range, bounds),
    trendCaption: trendCaptionFor(range),
    topItems,
    recentTransactions,
  }
}

// ---------------------------------------------------------------------------
// Sales report export (CSV)
// ---------------------------------------------------------------------------

export type SalesReportRow = {
  orderId: string
  dateTime: string
  itemsSold: string
  totalAmount: number
  paymentStatus: string
  orderType: string
}

type ItemsSoldLine = {
  quantity: number
  name: string
  addOns: string[]
}

// Nests add-on rows under their parent product for the Items Sold column.
// Mirrors the kitchen display grouping: POS saves add-on rows grouped per
// cart line in cart order, after the mains, and each main's total_price
// includes ITS OWN add-ons (lineUnitPrice = base + sum of add-on prices),
// so budget = total_price - (unit_price * quantity) exactly identifies
// which add-on rows belong to that line.
function buildItemsSoldLines(items: OrderItemRow[]): ItemsSoldLine[] {
  const mains: { row: OrderItemRow; addOns: string[] }[] = []
  const standaloneAddons: OrderItemRow[] = []

  for (const item of items) {
    if (isAddOnRow(item)) standaloneAddons.push(item)
    else mains.push({ row: item, addOns: [] })
  }

  if (mains.length === 0) {
    return standaloneAddons.map((row) => ({
      quantity: itemQuantity(row) || 1,
      name: itemName(row),
      addOns: [],
    }))
  }

  // PHASE 1: exact budget matching, consuming add-on rows in saved order
  let cursor = 0
  for (const main of mains) {
    const qty = itemQuantity(main.row) || 1
    const unit = Number(main.row.unit_price ?? main.row.price ?? 0)
    const total = Number(main.row.total_price ?? 0)
    const budget = total - unit * qty

    if (!(budget > 0) || cursor >= standaloneAddons.length) continue

    const start = cursor
    let sum = 0
    while (cursor < standaloneAddons.length && sum < budget) {
      const row = standaloneAddons[cursor]
      const rowTotal = Number(row.total_price ?? row.price ?? 0)
      if (rowTotal > 0 && sum + rowTotal > budget) break
      sum += rowTotal
      cursor++
    }

    if (sum === budget) {
      for (const row of standaloneAddons.slice(start, cursor)) {
        main.addOns.push(itemName(row))
      }
    } else {
      cursor = start // could not fill exactly — leave rows for phase 2
    }
  }

  // PHASE 2: leftovers (legacy/inconsistent totals) — best-effort attach by
  // quantity match, still never re-adding a duplicate name to a line.
  const leftovers = standaloneAddons.slice(cursor)
  const orphans: OrderItemRow[] = []
  for (const row of leftovers) {
    const label = itemName(row)
    const qty = itemQuantity(row) || 1
    const candidates = mains.filter(
      (main) => !main.addOns.some((name) => name.toLowerCase() === label.toLowerCase())
    )
    if (candidates.length === 0) {
      orphans.push(row)
      continue
    }
    const target =
      candidates.find((main) => (itemQuantity(main.row) || 1) === qty) ?? candidates[0]
    target.addOns.push(label)
  }

  const lines: ItemsSoldLine[] = mains.map((main) => ({
    quantity: itemQuantity(main.row) || 1,
    name: itemName(main.row),
    addOns: main.addOns,
  }))

  // Add-ons with no attachable parent still appear so no data is lost
  for (const row of orphans) {
    lines.push({ quantity: itemQuantity(row) || 1, name: itemName(row), addOns: [] })
  }

  return lines
}

export function formatItemsSold(items: OrderItemRow[]): string {
  return buildItemsSoldLines(items)
    .map((line) => {
      const addOns =
        line.addOns.length > 0 ? ` (${line.addOns.map((name) => `+ ${name}`).join(', ')})` : ''
      return `${line.quantity}x ${line.name}${addOns}`
    })
    .join('; ')
}

export async function getSalesReportRows(range: DateRangeKey): Promise<SalesReportRow[]> {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: true })

  if (error || !orders) {
    console.error('Error fetching orders for export:', error)
    return []
  }

  const bounds = getDateRangeBounds(range)
  const rangeOrders = ((orders ?? []) as OrderRow[]).filter((order) =>
    withinRange(order.created_at, bounds)
  )

  const items = await fetchOrderItems(rangeOrders.map((order) => order.id))
  const itemsByOrder = new Map<string, OrderItemRow[]>()
  for (const item of items) {
    const orderId = String(item.order_id ?? '')
    const list = itemsByOrder.get(orderId) ?? []
    list.push(item)
    itemsByOrder.set(orderId, list)
  }

  return rangeOrders.map((order) => {
    const orderItems = itemsByOrder.get(order.id) ?? []
    const itemsSold = formatItemsSold(orderItems)

    return {
      orderId: String(order.order_number ?? order.id),
      dateTime: formatDateTime(order.created_at),
      itemsSold,
      totalAmount: orderTotal(order),
      paymentStatus: statusLabel(order),
      orderType: String(order.order_type ?? order.type ?? '—'),
    }
  })
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function salesReportToCsv(rows: SalesReportRow[]): string {
  const header = [
    'Order ID',
    'Date/Time',
    'Items Sold',
    'Total Amount',
    'Payment Status',
    'Order Type',
  ]
  const lines = [header.join(',')]
  for (const row of rows) {
    lines.push(
      [
        csvEscape(row.orderId),
        csvEscape(row.dateTime),
        csvEscape(row.itemsSold),
        row.totalAmount.toFixed(2),
        csvEscape(row.paymentStatus),
        csvEscape(row.orderType),
      ].join(',')
    )
  }
  return lines.join('\r\n')
}

export function formatHour(hour: number) {
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const display = hour % 12 === 0 ? 12 : hour % 12
  return `${display}${suffix}`
}
