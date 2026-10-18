import type { Series } from './ColumnChart.vue'

/**
 * Chart colors. Weight classes are ordered states, so they take the status
 * steps (good → warning → critical) plus a neutral for revoked; a legend and
 * per-column tooltips always carry the meaning alongside the color.
 */
export const WEIGHT_SERIES: Series[] = [
  { key: 'clean', label: 'full weight', color: '#0ca30c' },
  { key: 'discounted', label: 'discounted', color: '#fab219' },
  { key: 'zero', label: 'weight 0', color: '#d03b3b' },
  { key: 'revoked', label: 'revoked', color: '#5b6472' },
]

/** Single-series magnitude (distributions, volumes). */
export const COUNT_SERIES: Series[] = [{ key: 'count', label: 'rows', color: '#3987e5' }]

export type WeightClass = 'clean' | 'discounted' | 'zero' | 'revoked'

export function weightClass(revoked: boolean, weight: number): WeightClass {
  return revoked ? 'revoked' : weight === 0 ? 'zero' : weight < 1 ? 'discounted' : 'clean'
}

export const WEIGHT_LABELS: Record<string, string> = Object.fromEntries(WEIGHT_SERIES.map((s) => [s.key, s.label]))
