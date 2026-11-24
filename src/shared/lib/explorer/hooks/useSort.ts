import { useMemo, useState } from 'react';

export type SortPrimitive = string | number | bigint | null | undefined;
export type SortDir = 'asc' | 'desc';

/** One sortable column: a label key and how to read the value from a row. */
export type SortColumn<T> = { key: string; value: (row: T) => SortPrimitive; numeric?: boolean };

function compare(a: SortPrimitive, b: SortPrimitive): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  if (typeof a === 'bigint' || typeof b === 'bigint') {
    const x = typeof a === 'bigint' ? a : BigInt(Math.trunc(Number(a)));
    const y = typeof b === 'bigint' ? b : BigInt(Math.trunc(Number(b)));
    return x < y ? -1 : x > y ? 1 : 0;
  }
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Client-side column sorting for a table whose rows are already on the page.
 * Starts unsorted so the natural order is preserved until a header is clicked.
 */
export function useSort<T>(rows: T[], columns: SortColumn<T>[]) {
  const [key, setKey] = useState<string | null>(null);
  const [dir, setDir] = useState<SortDir>('asc');
  const byKey = useMemo(() => new Map(columns.map((column) => [column.key, column])), [columns]);

  const sorted = useMemo(() => {
    const list = [...rows];
    const column = key ? byKey.get(key) : undefined;
    if (!column) return list;
    const factor = dir === 'asc' ? 1 : -1;
    return list.sort((a, b) => factor * compare(column.value(a), column.value(b)));
  }, [rows, key, dir, byKey]);

  function toggle(next: string) {
    if (key === next) {
      setDir(dir === 'asc' ? 'desc' : 'asc');
    } else {
      setKey(next);
      setDir(byKey.get(next)?.numeric ? 'desc' : 'asc');
    }
  }

  function state(next: string): SortDir | null {
    return key === next ? dir : null;
  }

  return { sorted, key, dir, toggle, state };
}
