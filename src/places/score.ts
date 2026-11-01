import { filteredScore, type Confidence } from '../data/reputation/score'
import type { RatingUnit, WalletRating } from '../data/reputation/units'
import type { Place, Review } from './types'

// A Google review is a "wallet" rating: one account, one vote on a place. The
// reputation core (Beta posterior, interval, effective reviewers, cost to fake)
// is reused untouched; only the weights are place-specific.

export const HALF_LIFE_DAYS = 730
/** Old reviews fade, never vanish: a place's character outlasts a year. */
export const TIME_FLOOR = 0.3
/** Reviews inside one burst window; a farm posts its batch within days. */
export const BURST_WINDOW_DAYS = 7
export const BURST_SHARE = 0.3
export const BURST_MIN_REVIEWS = 8
/** Identical text this many times is a template. */
export const TEMPLATE_MIN = 3
/** Credibility below this counts as a throwaway account. */
export const LOW_CRED = 0.4
export const BURST_FACTOR = 0.5
export const TEMPLATE_FACTOR = 0.25
/** Neutral credibility when the source returns no reviewer history. */
export const UNKNOWN_CRED = 0.6

const DAY_MS = 86_400_000

export type ReviewFlag = 'burst' | 'template' | 'low-cred'

export type ScoredReview = {
  review: Review
  credibility: number
  /** Time decay × credibility × penalties, capped at one full vote. */
  weight: number
  flags: ReviewFlag[]
}

export type Finding = { level: 'warn' | 'info'; code: 'burst' | 'template' | 'low-cred' | 'gap' | 'thin'; text: string }

export type PlaceReputation = {
  /** Filtered score on the 1–5 star scale; null when there are no reviews. */
  score: number | null
  /** 80% Beta interval, 1–5. */
  interval: [number, number] | null
  confidence: Confidence
  unrated: boolean
  /** Plain mean of the sampled stars. */
  sampleMean: number | null
  googleRating: number | undefined
  /** googleRating − score; large positive = the rules removed inflation. */
  inflation: number | null
  /** Fresh unlinked accounts needed to push the score to 4.6. */
  cost: number | null
  reviews: number
  neff: number
  top1: number
  /** Share of 5★ reviews written by throwaway accounts. */
  lowCredFiveShare: number
  distribution: { stars: number; count: number; weight: number }[]
  scored: ScoredReview[]
  findings: Finding[]
}

const stars = (value: number) => 1 + 4 * value

/** 0.1–1 from account age, history, photos and Local Guide level. */
export function credibility(review: Review): number {
  const s = review.authorStats
  if (!s) return UNKNOWN_CRED
  const published = Date.parse(review.publishTime)
  const ageDays = Math.max(0, (published - Date.parse(s.memberSince)) / DAY_MS)
  const c =
    0.15 +
    0.25 * Math.min(1, Math.log10(1 + s.reviewCount) / 2) +
    0.2 * Math.min(1, ageDays / 730) +
    0.15 * Math.min(1, s.localGuideLevel / 5) +
    0.1 * (review.authorAttribution.photoUri ? 1 : 0) +
    0.1 * Math.min(1, s.photoCount / 5) +
    0.05 * (review.text ? 1 : 0)
  return Math.min(1, Math.max(0.1, c))
}

function normalise(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

/** Reviews that sit inside the densest 7-day window, when it is dense enough to be a burst. */
export function burstMembers(times: number[]): Set<number> {
  const out = new Set<number>()
  if (times.length < BURST_MIN_REVIEWS) return out
  const order = times.map((t, i) => [t, i] as const).sort((a, b) => a[0] - b[0])
  const span = BURST_WINDOW_DAYS * DAY_MS
  let best: [number, number] = [0, 0]
  let lo = 0
  for (let hi = 0; hi < order.length; hi++) {
    while (order[hi][0] - order[lo][0] > span) lo++
    if (hi - lo > best[1] - best[0]) best = [lo, hi]
  }
  if ((best[1] - best[0] + 1) / times.length < BURST_SHARE) return out
  for (let k = best[0]; k <= best[1]; k++) out.add(order[k][1])
  return out
}

export function scorePlace(place: Pick<Place, 'rating'>, reviews: readonly Review[], now = Date.now()): PlaceReputation {
  const times = reviews.map((r) => Date.parse(r.publishTime))
  const burst = burstMembers(times)
  const templateCount = new Map<string, number>()
  for (const r of reviews) {
    if (!r.text) continue
    const key = normalise(r.text.text)
    templateCount.set(key, (templateCount.get(key) ?? 0) + 1)
  }

  const scored: ScoredReview[] = reviews.map((review, i) => {
    const credibilityValue = credibility(review)
    const flags: ReviewFlag[] = []
    if (burst.has(i)) flags.push('burst')
    if (review.text && (templateCount.get(normalise(review.text.text)) ?? 0) >= TEMPLATE_MIN) flags.push('template')
    if (credibilityValue < LOW_CRED) flags.push('low-cred')
    const ageDays = Math.max(0, (now - times[i]) / DAY_MS)
    const time = Math.max(TIME_FLOOR, 2 ** (-ageDays / HALF_LIFE_DAYS))
    const penalty = (flags.includes('burst') ? BURST_FACTOR : 1) * (flags.includes('template') ? TEMPLATE_FACTOR : 1)
    return { review, credibility: credibilityValue, weight: Math.min(1, time) * credibilityValue * penalty, flags }
  })

  const wallets: WalletRating[] = scored.map((s, i) => {
    const r = (s.review.rating - 1) / 4
    const unit: RatingUnit = {
      client: s.review.authorAttribution.uri,
      tag: 'place',
      bucket: Math.floor(times[i] / (30 * DAY_MS)),
      r,
      rows: [i],
      ageDays: Math.max(0, (now - times[i]) / DAY_MS),
      time: s.weight,
    }
    return { client: unit.client, units: [unit], r, weight: s.weight, rows: 1 }
  })

  const core = filteredScore(wallets)
  const score = core.value === null ? null : stars(core.value)
  const sampleMean = reviews.length ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : null
  const inflation = score !== null && place.rating !== undefined ? place.rating - score : null

  const fives = scored.filter((s) => s.review.rating === 5)
  const lowCredFiveShare = fives.length ? fives.filter((s) => s.flags.includes('low-cred')).length / fives.length : 0
  const distribution = [5, 4, 3, 2, 1].map((n) => {
    const rows = scored.filter((s) => s.review.rating === n)
    return { stars: n, count: rows.length, weight: rows.reduce((a, s) => a + s.weight, 0) }
  })

  const findings: Finding[] = []
  const burstN = scored.filter((s) => s.flags.includes('burst')).length
  const templateN = scored.filter((s) => s.flags.includes('template')).length
  if (burstN) findings.push({ level: 'warn', code: 'burst', text: `${burstN} of ${reviews.length} reviews landed inside one ${BURST_WINDOW_DAYS}-day window.` })
  if (templateN) findings.push({ level: 'warn', code: 'template', text: `${templateN} reviews repeat the same text word for word.` })
  if (reviews.length >= 10 && lowCredFiveShare >= 0.35) {
    findings.push({ level: 'warn', code: 'low-cred', text: `${Math.round(lowCredFiveShare * 100)}% of the 5★ reviews come from throwaway accounts.` })
  }
  if (inflation !== null && Math.abs(inflation) >= 0.5) {
    findings.push({
      level: 'warn',
      code: 'gap',
      text: `Google shows ${place.rating?.toFixed(1)}★; weighted by who reviewed and when it is ${score?.toFixed(1)}★.`,
    })
  }
  if (reviews.length < 5) findings.push({ level: 'info', code: 'thin', text: 'Fewer than 5 reviews: the score is mostly the prior.' })

  return {
    score,
    interval: core.interval ? [stars(core.interval[0]), stars(core.interval[1])] : null,
    confidence: core.confidence,
    unrated: core.unrated,
    sampleMean,
    googleRating: place.rating,
    inflation,
    cost: core.cost,
    reviews: reviews.length,
    neff: core.neff,
    top1: core.top1,
    lowCredFiveShare,
    distribution,
    scored,
    findings,
  }
}
