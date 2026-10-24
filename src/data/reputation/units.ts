import type { Feedback } from '../types'
import { classify, type Classified, type TagProfile } from './kinds'

const DAY = 86400

/** One reviewer's reviews of one tag in one window collapse to a single unit. */
export const UNIT_WINDOW_DAYS = 30
/** A unit's weight halves every this many days. */
export const HALF_LIFE_DAYS = 90

export type RatingUnit = {
  client: string
  tag: string
  /** Window number from the epoch, or `'undated'` when the row has no date. */
  bucket: number | 'undated'
  /** Median of the row ratings in the unit, in [0,1]. */
  r: number
  /** Row indexes (into the feedback array) that formed the unit. */
  rows: number[]
  /** Days between the unit and "now"; 0 when undated. */
  ageDays: number
  /** Time decay, in (0,1]. */
  time: number
}

export type WalletRating = {
  client: string
  units: RatingUnit[]
  /** Median of its units; what the wallet contributes. */
  r: number
  /** min(1, Σ time) — one wallet can never hold more than one full vote. */
  weight: number
  /** Rows behind its units. */
  rows: number
}

export type KindCounts = {
  total: number
  revoked: number
  rating: number
  outcome: number
  telemetry: number
  metric: number
  unknown: number
  /** Rating rows whose value fits no scale. */
  outOfScale: number
  /** Rows from the agent's own owner/agent wallet. */
  self: number
}

export type RatingLayer = {
  /** Parallel to the feedback array. */
  classified: Classified[]
  tags: TagProfile[]
  units: RatingUnit[]
  wallets: WalletRating[]
  counts: KindCounts
}

export function median(xs: number[]): number | null {
  if (xs.length === 0) return null
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/**
 * Rows → kinds → rating units → one aggregate per wallet. Only RATING rows
 * enter: latency, uptime, revenue, pass flags and unknown tags are counted and
 * shown, never averaged into the score.
 */
export function buildRatingLayer(feedback: Feedback[], opts: { self?: readonly string[]; now?: number } = {}): RatingLayer {
  const selves = new Set((opts.self ?? []).map((a) => a.toLowerCase()))
  const { rows: classified, tags } = classify(feedback)
  const counts: KindCounts = { total: feedback.length, revoked: 0, rating: 0, outcome: 0, telemetry: 0, metric: 0, unknown: 0, outOfScale: 0, self: 0 }

  const dated = feedback.flatMap((f) => (f.createdAt === undefined ? [] : [f.createdAt]))
  const now = opts.now ?? (dated.length ? Math.max(...dated) : Math.floor(Date.now() / 1000))

  const units: RatingUnit[] = []
  const byKey = new Map<string, { unit: RatingUnit; ratings: number[] }>()
  classified.forEach((c, i) => {
    const f = feedback[i]
    if (f.revoked) {
      counts.revoked++
      return
    }
    counts[c.kind]++
    if (selves.has(f.client.toLowerCase())) {
      counts.self++
      return
    }
    if (c.kind !== 'rating') return
    if (c.r === null) {
      counts.outOfScale++
      return
    }
    const bucket = f.createdAt === undefined ? ('undated' as const) : Math.floor(f.createdAt / (UNIT_WINDOW_DAYS * DAY))
    const key = `${f.client.toLowerCase()}|${c.tag}|${bucket}`
    const ageDays = f.createdAt === undefined ? 0 : Math.max(0, (now - f.createdAt) / DAY)
    let hit = byKey.get(key)
    if (!hit) {
      hit = {
        unit: {
          client: f.client,
          tag: c.tag,
          bucket,
          r: c.r,
          rows: [],
          ageDays,
          time: 2 ** (-ageDays / HALF_LIFE_DAYS),
        },
        ratings: [],
      }
      byKey.set(key, hit)
      units.push(hit.unit)
    }
    hit.ratings.push(c.r)
    hit.unit.rows.push(i)
  })
  for (const hit of byKey.values()) hit.unit.r = median(hit.ratings) ?? hit.unit.r

  const byClient = new Map<string, WalletRating>()
  for (const unit of units) {
    const key = unit.client.toLowerCase()
    let wallet = byClient.get(key)
    if (!wallet) {
      wallet = { client: unit.client, units: [], r: 0, weight: 0, rows: 0 }
      byClient.set(key, wallet)
    }
    wallet.units.push(unit)
    wallet.rows += unit.rows.length
  }
  const wallets = [...byClient.values()].map((wallet) => ({
    ...wallet,
    r: median(wallet.units.map((u) => u.r)) ?? 0,
    weight: Math.min(1, wallet.units.reduce((a, u) => a + u.time, 0)),
  }))
  wallets.sort((a, b) => b.weight - a.weight || b.rows - a.rows)

  return { classified, tags, units, wallets, counts }
}
