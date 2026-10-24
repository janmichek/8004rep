import { computed, ref, toValue, type MaybeRefOrGetter } from 'vue'

export type SortPrimitive = string | number | bigint | null | undefined
export type SortDir = 'asc' | 'desc'

/** One sortable column: a label key and how to read the value from a row. */
export type SortColumn<T> = { key: string; value: (row: T) => SortPrimitive; numeric?: boolean }

function compare(a: SortPrimitive, b: SortPrimitive): number {
  if (a === b) return 0
  if (a === null || a === undefined) return 1
  if (b === null || b === undefined) return -1
  if (typeof a === 'bigint' || typeof b === 'bigint') {
    const x = typeof a === 'bigint' ? a : BigInt(Math.trunc(Number(a)))
    const y = typeof b === 'bigint' ? b : BigInt(Math.trunc(Number(b)))
    return x < y ? -1 : x > y ? 1 : 0
  }
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
}

/**
 * Client-side column sorting for a table whose rows are already on the page.
 * Starts unsorted so the natural order is preserved until a header is clicked.
 */
export function useSort<T>(rows: MaybeRefOrGetter<T[]>, columns: SortColumn<T>[]) {
  const byKey = new Map(columns.map((column) => [column.key, column]))
  const key = ref<string | null>(null)
  const dir = ref<SortDir>('asc')

  const sorted = computed(() => {
    const list = [...toValue(rows)]
    const column = key.value ? byKey.get(key.value) : undefined
    if (!column) return list
    const factor = dir.value === 'asc' ? 1 : -1
    return list.sort((a, b) => factor * compare(column.value(a), column.value(b)))
  })

  function toggle(next: string): void {
    if (key.value === next) {
      dir.value = dir.value === 'asc' ? 'desc' : 'asc'
    } else {
      key.value = next
      dir.value = byKey.get(next)?.numeric ? 'desc' : 'asc'
    }
  }

  function state(next: string): SortDir | null {
    return key.value === next ? dir.value : null
  }

  return { sorted, key, dir, toggle, state }
}
