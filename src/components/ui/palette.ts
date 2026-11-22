import type { Series } from './ColumnChart.vue'

/**
 * Chart colors. Every series is a shade of the brand cyan (#22d3ee); weight
 * classes are ordered states, so they run light → dark (full weight → revoked).
 * A legend and per-column tooltips always carry the meaning alongside the color.
 */
export const WEIGHT_SERIES: Series[] = [
  { key: 'clean', label: 'full weight', color: 'var(--cyan-300)' },
  { key: 'discounted', label: 'discounted', color: 'var(--cyan-400)' },
  { key: 'zero', label: 'weight 0', color: 'var(--cyan-500)' },
  { key: 'revoked', label: 'revoked', color: 'var(--cyan-600)' },
]

/** Single-series magnitude (distributions, volumes). */
export const COUNT_SERIES: Series[] = [{ key: 'count', label: 'reviews', color: 'var(--cyan-400)' }]

export type WeightClass = 'clean' | 'discounted' | 'zero' | 'revoked'

export function weightClass(revoked: boolean, weight: number): WeightClass {
  return revoked ? 'revoked' : weight === 0 ? 'zero' : weight < 1 ? 'discounted' : 'clean'
}

export const WEIGHT_LABELS: Record<string, string> = Object.fromEntries(WEIGHT_SERIES.map((s) => [s.key, s.label]))
