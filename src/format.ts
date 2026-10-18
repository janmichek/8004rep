import { formatUnits } from 'viem'

export function shortAddress(address: string): string {
  return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address
}

export function formatDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10)
}

/** Feedback values are 0-100 by convention but any decimal is legal; trim noise. */
export function formatScore(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

export function formatTimeline(unixSeconds: number, nowMs = Date.now()): string {
  const diff = Math.max(0, Math.floor(nowMs / 1000) - unixSeconds)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}d ago`
  if (diff < 86400 * 365) return `${Math.floor(diff / (86400 * 30))}mo ago`
  return `${Math.floor(diff / (86400 * 365))}y ago`
}
export function formatDuration(seconds: number): string {
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  if (seconds < 172800) return `${Math.round(seconds / 3600)}h`
  return `${Math.round(seconds / 86400)}d`
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) {
    // viem errors carry a one-line summary; the full message is a multi-line dump.
    const short = (err as { shortMessage?: unknown }).shortMessage
    return typeof short === 'string' ? short : err.message
  }
  return String(err)
}

/**
 * Token amount from its base units: up to `digits` decimals, or four
 * significant ones when it is below 1, trailing zeros dropped.
 */
export function formatAmount(value: bigint, decimals: number, digits = 6): string {
  const [whole, fraction = ''] = formatUnits(value, decimals).split('.')
  const leadingZeros = fraction.length - fraction.replace(/^0+/, '').length
  const kept = fraction.slice(0, whole === '0' || whole === '-0' ? Math.max(digits, leadingZeros + 4) : digits).replace(/0+$/, '')
  return kept ? `${whole}.${kept}` : whole
}

/** One decimal at most, '—' for nothing; small non-zero values keep two significant digits. */
export function formatNumber(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  if (value !== 0 && Math.abs(value) < 1) return String(Number(value.toPrecision(2)))
  return formatScore(Number(value.toFixed(digits)))
}

export function formatPercent(share: number | null | undefined): string {
  return share === null || share === undefined ? '—' : `${Math.round(share * 100)}%`
}

export function formatSigned(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  if (Math.abs(value) < 0.05) return '±0'
  return `${value > 0 ? '+' : ''}${formatNumber(value)}`
}
