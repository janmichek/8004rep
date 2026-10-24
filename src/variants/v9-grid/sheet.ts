import type { RouteLocationRaw } from 'vue-router'

export type Cell = string | number | null | undefined

export type Column<T> = {
  key: string
  label: string
  /** Raw value: sorts, exports, and shows unless `show` formats it. */
  get: (row: T) => Cell
  show?: (row: T) => string
  /** The "formula": how the value is derived, shown in the formula bar. */
  formula: string
  num?: boolean
  link?: (row: T) => RouteLocationRaw | undefined
  href?: (row: T) => string | undefined
  hidden?: boolean
  width?: string
  tone?: (row: T) => 'bad' | 'warn' | 'good' | undefined
}

/** A, B, …, Z, AA, AB… */
export function columnLetter(i: number): string {
  let s = ''
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s
  return s
}
