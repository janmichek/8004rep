import type { RiskLevel } from '../../data/feedbackStats'
import { LABEL_INFO, type ReviewerLabel } from '../../data/reviewerProfile'
import type { StrengthTier } from '../../data/trustReport'
import type { Feedback, FeedbackEvent, ReputationSummary } from '../../data/types'

// Values the classic design does not compute. Each is a plain function of
// rows already on screen, so a reader can re-derive it from the tables.

const DAY = 86400

/** Gini coefficient of non-negative counts: 0 = spread evenly, → 1 = one holder has it all. */
export function gini(counts: number[]): number | null {
  const xs = counts.filter((c) => c >= 0).sort((a, b) => a - b)
  const n = xs.length
  const total = xs.reduce((a, b) => a + b, 0)
  if (n < 2 || total === 0) return n === 1 && total > 0 ? 0 : null
  let weighted = 0
  xs.forEach((x, i) => (weighted += (i + 1) * x))
  return (2 * weighted) / (n * total) - (n + 1) / n
}

/** Shannon entropy of counts, normalized to 0–1 (1 = perfectly even spread). */
export function evenness(counts: number[]): number | null {
  const xs = counts.filter((c) => c > 0)
  if (xs.length < 2) return xs.length === 1 ? 0 : null
  const total = xs.reduce((a, b) => a + b, 0)
  const h = -xs.reduce((acc, c) => acc + (c / total) * Math.log(c / total), 0)
  return h / Math.log(xs.length)
}

/** Share of the total held by the `k` largest counts. */
export function topShare(counts: number[], k: number): number | null {
  const total = counts.reduce((a, b) => a + b, 0)
  if (!total) return null
  const top = [...counts].sort((a, b) => b - a).slice(0, k)
  return top.reduce((a, b) => a + b, 0) / total
}

/** Effective number of holders: 1 / Σ share² (inverse Herfindahl). */
export function effectiveCount(counts: number[]): number | null {
  const total = counts.reduce((a, b) => a + b, 0)
  if (!total) return null
  return 1 / counts.reduce((acc, c) => acc + (c / total) ** 2, 0)
}

/** 7×24 counts by UTC weekday (0 = Monday) and hour. */
export function weekHourGrid(times: (number | undefined)[]): number[][] {
  const grid = Array.from({ length: 7 }, () => Array<number>(24).fill(0))
  for (const t of times) {
    if (t === undefined) continue
    const d = new Date(t * 1000)
    grid[(d.getUTCDay() + 6) % 7][d.getUTCHours()]++
  }
  return grid
}

/** Rows per day between the first and last dated row; null below two dated rows. */
export function velocity(times: (number | undefined)[]): number | null {
  const ts = times.filter((t): t is number => t !== undefined)
  if (ts.length < 2) return null
  const span = Math.max(...ts) - Math.min(...ts)
  return ts.length / Math.max(1, span / DAY)
}

/** Distinct UTC days with at least one row, and the longest run of consecutive ones. */
export function activeDays(times: (number | undefined)[]): { days: number; streak: number } {
  const days = [...new Set(times.filter((t): t is number => t !== undefined).map((t) => Math.floor(t / DAY)))].sort((a, b) => a - b)
  let streak = days.length ? 1 : 0
  let run = 1
  for (let i = 1; i < days.length; i++) {
    run = days[i] === days[i - 1] + 1 ? run + 1 : 1
    streak = Math.max(streak, run)
  }
  return { days: days.length, streak }
}

/** Running mean of non-revoked dated rows, oldest first: how the average got where it is. */
export function runningAverage(feedback: Feedback[]): { t: number; average: number }[] {
  const dated = feedback.filter((f) => !f.revoked && f.createdAt !== undefined).sort((a, b) => a.createdAt! - b.createdAt!)
  let sum = 0
  return dated.map((f, i) => {
    sum += f.value
    return { t: f.createdAt!, average: sum / (i + 1) }
  })
}

/** Prior weight of the shrunk rank score, in reviews. */
export const RANK_PRIOR_WEIGHT = 5

/**
 * Bayesian rank score: the on-chain average pulled toward `prior` by
 * `RANK_PRIOR_WEIGHT` phantom reviews, so two 100s do not outrank fifty 92s.
 */
export function rankScore(summary: ReputationSummary | undefined, prior: number): number | null {
  if (!summary || summary.count === 0) return null
  return (summary.count * summary.average + RANK_PRIOR_WEIGHT * prior) / (summary.count + RANK_PRIOR_WEIGHT)
}

export type Grade = 'A+' | 'A' | 'B' | 'C' | 'D' | 'F' | 'NR'

/**
 * Letter grade: trusted score banded, then capped by thin evidence (B at
 * best) and by risk (high risk = D at best, needs a look = B at best).
 * NR = not rated (no usable evidence).
 */
export function letterGrade(trusted: number | null, tier: StrengthTier, level: RiskLevel | 'clean'): Grade {
  if (trusted === null || tier === 'none') return 'NR'
  const ORDER: Grade[] = ['A+', 'A', 'B', 'C', 'D', 'F']
  let g: Grade = trusted >= 95 ? 'A+' : trusted >= 85 ? 'A' : trusted >= 70 ? 'B' : trusted >= 55 ? 'C' : trusted >= 40 ? 'D' : 'F'
  const cap = (limit: Grade) => {
    if (ORDER.indexOf(g) < ORDER.indexOf(limit)) g = limit
  }
  if (tier === 'thin') cap('B')
  if (level === 'warn') cap('B')
  if (level === 'high') cap('D')
  return g
}

export const GRADE_RULE =
  'Trusted score banded (95+ A+, 85+ A, 70+ B, 55+ C, 40+ D, else F), then capped: thin evidence or “needs a look” → B at best, high risk → D at best.'

/** Reviewer → agent edges of a feed, with row counts. */
export type Edge = { client: string; tokenId: bigint; rows: number }

export function edgesOf(rows: FeedbackEvent[]): Edge[] {
  const map = new Map<string, Edge>()
  for (const r of rows) {
    const key = `${r.client.toLowerCase()}|${r.tokenId}`
    const e = map.get(key)
    if (e) e.rows++
    else map.set(key, { client: r.client.toLowerCase(), tokenId: r.tokenId, rows: 1 })
  }
  return [...map.values()]
}

/** Agents reached only through reviewers that also rate `tokenId`: its neighbourhood. */
export function coRated(rows: FeedbackEvent[], clients: string[], tokenId: bigint): { tokenId: bigint; agentName?: string; shared: number }[] {
  const mine = new Set(clients.map((c) => c.toLowerCase()))
  const by = new Map<bigint, { tokenId: bigint; agentName?: string; who: Set<string> }>()
  for (const r of rows) {
    if (r.tokenId === tokenId || !mine.has(r.client.toLowerCase())) continue
    const e = by.get(r.tokenId) ?? { tokenId: r.tokenId, agentName: r.agentName, who: new Set<string>() }
    e.who.add(r.client.toLowerCase())
    by.set(r.tokenId, e)
  }
  return [...by.values()].map((e) => ({ tokenId: e.tokenId, agentName: e.agentName, shared: e.who.size })).sort((a, b) => b.shared - a.shared)
}

/** Polar position of item `i` of `n` on a ring of radius `r` around (cx, cy). */
export function ring(i: number, n: number, r: number, cx = 0, cy = 0, phase = -Math.PI / 2): { x: number; y: number } {
  const a = phase + (2 * Math.PI * i) / Math.max(1, n)
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
}

/** Day buckets (UTC) of a feed, newest first, for day-separated streams. */
export function byDay<T extends { createdAt?: number }>(rows: T[]): { day: number | null; rows: T[] }[] {
  const out: { day: number | null; rows: T[] }[] = []
  for (const r of rows) {
    const day = r.createdAt === undefined ? null : Math.floor(r.createdAt / DAY) * DAY
    const last = out.at(-1)
    if (last && last.day === day) last.rows.push(r)
    else out.push({ day, rows: [r] })
  }
  return out
}

/** Comma-separated values with RFC 4180 quoting. */
export function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  const cell = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [header, ...rows].map((r) => r.map(cell).join(',')).join('\n')
}

export function downloadText(name: string, text: string, type = 'text/csv'): void {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

/** A sparkline path over `values` in a `w`×`h` box; empty below two points. */
export function sparkPath(values: number[], w: number, h: number, lo = Math.min(...values), hi = Math.max(...values)): string {
  if (values.length < 2) return ''
  const span = hi - lo || 1
  return values
    .map((v, i) => `${i ? 'L' : 'M'}${((i / (values.length - 1)) * w).toFixed(1)},${(h - ((v - lo) / span) * h).toFixed(1)}`)
    .join(' ')
}

/** Text bar of `width` cells for a 0–1 share. */
export function asciiBar(share: number, width = 20): string {
  const filled = Math.round(Math.max(0, Math.min(1, share)) * width)
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

/** Reviewer labels as prose ("rubber stamp, bulk writer"). */
export function labelsText(labels: ReviewerLabel[]): string {
  return labels.map((label) => LABEL_INFO[label].label).join(', ')
}

/** Sparkline on a 0–100 scale, stretched when values leave it. */
export function sparkPath100(values: number[], w: number, h: number): string {
  return values.length ? sparkPath(values, w, h, Math.min(0, ...values), Math.max(100, ...values)) : ''
}

/** Arithmetic mean; null for no values. */
export function mean(values: number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
}

/** Population standard deviation; null below two values. */
export function stdDev(values: number[]): number | null {
  if (values.length < 2) return null
  const avg = mean(values)!
  return Math.sqrt(values.reduce((a, b) => a + (b - avg) ** 2, 0) / values.length)
}

/** Equally wide buckets, each with the values that fell inside; `to` is exclusive except in the last bucket. */
export function histogram(values: number[], bins = 10, min = 0, max = 100): { from: number; to: number; count: number }[] {
  const width = (max - min) / bins
  const out = Array.from({ length: bins }, (_, i) => ({ from: min + i * width, to: min + (i + 1) * width, count: 0 }))
  for (const v of values) {
    if (v < min || v > max) continue
    const i = Math.min(bins - 1, Math.floor((v - min) / width))
    out[i].count++
  }
  return out
}

/** `q`-quantile (0–1) by linear interpolation; null for no values. */
export function quantile(values: number[], q: number): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const at = Math.max(0, Math.min(1, q)) * (sorted.length - 1)
  const lo = Math.floor(at)
  const hi = Math.ceil(at)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (at - lo)
}

export type Candle = { day: number; open: number; high: number; low: number; close: number; count: number }

/** Daily open/high/low/close of non-revoked review values, oldest day first. */
export function candles(rows: { value: number; revoked: boolean; createdAt?: number }[]): Candle[] {
  const days = new Map<number, number[]>()
  for (const row of rows) {
    if (row.revoked || row.createdAt === undefined) continue
    const day = Math.floor(row.createdAt / DAY) * DAY
    const values = days.get(day)
    if (values) values.push(row.value)
    else days.set(day, [row.value])
  }
  return [...days.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([day, values]) => ({
      day,
      open: values[0],
      high: Math.max(...values),
      low: Math.min(...values),
      close: values[values.length - 1],
      count: values.length,
    }))
}

/** Deterministic point in a `w`×`h` box (inset by `pad`), from a string seed. */
export function seededPoint(seed: string, w: number, h: number, pad = 0): { x: number; y: number } {
  let state = 2166136261
  for (let i = 0; i < seed.length; i++) state = Math.imul(state ^ seed.charCodeAt(i), 16777619)
  const next = () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return (state >>> 0) / 4294967296
  }
  return { x: pad + next() * Math.max(0, w - 2 * pad), y: pad + next() * Math.max(0, h - 2 * pad) }
}
