import { formatDate } from '../format'

const DAY = 86400

/** One column of a chart: stacked segments keyed by series, bottom first. */
export type Column = { label: string; segments: { key: string; value: number }[]; title: string }

/**
 * Values in tenths of the conventional 0–100 scale, with an extra bin on
 * either side only when values leave it.
 */
export function valueHistogram(values: number[], unit = 'feedback'): Column[] {
  const bins = Array.from({ length: 10 }, (_, i) => ({ from: i * 10, to: i * 10 + 10, count: 0 }))
  let below = 0
  let above = 0
  for (const v of values) {
    if (v < 0) below++
    else if (v > 100) above++
    // 100 belongs to the last bin, 90–100.
    else bins[Math.min(9, Math.floor(v / 10))].count++
  }
  const plural = (n: number) => `${n} ${unit}`
  const columns: Column[] = bins.map((b, i) => ({
    label: i === 9 ? '90–100' : `${b.from}–${b.to}`,
    segments: [{ key: 'count', value: b.count }],
    title: `${i === 9 ? '90 to 100' : `${b.from} to under ${b.to}`}: ${plural(b.count)}`,
  }))
  if (below) columns.unshift({ label: '< 0', segments: [{ key: 'count', value: below }], title: `Below 0: ${plural(below)}` })
  if (above) columns.push({ label: '> 100', segments: [{ key: 'count', value: above }], title: `Above 100: ${plural(above)}` })
  return columns
}

/**
 * One column per UTC day from the first dated item to the last, empty days
 * included so gaps stay visible. `kindOf` picks the series of each item.
 * Spans longer than `maxDays` are grouped into weeks.
 */
export function dailyColumns<T>(
  items: T[],
  timeOf: (item: T) => number | undefined,
  kindOf: (item: T) => string,
  kinds: readonly string[],
  labels: Record<string, string>,
  maxDays = 90,
): Column[] {
  const dated = items.flatMap((item) => {
    const t = timeOf(item)
    return t === undefined ? [] : [{ day: Math.floor(t / DAY), kind: kindOf(item) }]
  })
  if (dated.length === 0) return []
  const first = Math.min(...dated.map((d) => d.day))
  const last = Math.max(...dated.map((d) => d.day))
  const step = last - first + 1 > maxDays ? 7 : 1
  const slots = Math.floor((last - first) / step) + 1
  const counts = Array.from({ length: slots }, () => new Map<string, number>())
  for (const d of dated) {
    const slot = counts[Math.floor((d.day - first) / step)]
    slot.set(d.kind, (slot.get(d.kind) ?? 0) + 1)
  }
  return counts.map((count, i) => {
    const start = formatDate((first + i * step) * DAY)
    const segments = kinds.map((key) => ({ key, value: count.get(key) ?? 0 })).filter((s) => s.value > 0)
    const total = segments.reduce((a, s) => a + s.value, 0)
    return {
      label: start,
      segments,
      title: `${step === 7 ? `Week of ${start}` : start} · ${total} feedback${
        total ? ` · ${segments.map((s) => `${s.value} ${labels[s.key] ?? s.key}`).join(', ')}` : ''
      }`,
    }
  })
}
