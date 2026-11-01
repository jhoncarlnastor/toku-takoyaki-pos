export const CURRENCY_SYMBOL = '₱'
export const CURRENCY_CODE = 'PHP'

const pesoFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: CURRENCY_CODE,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatPeso(value: number | null | undefined) {
  const amount = typeof value === 'number' && Number.isFinite(value) ? value : 0
  return pesoFormatter.format(amount)
}
