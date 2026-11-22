import type { Address } from 'viem'
import { formatScore, shortAddress } from '../format'
import { classify, inferTagScales, type Kind } from './reputation/kinds'
import { computeWeights, medianOf, type WeightReason } from './scores'
import type { Feedback } from './types'

const DAY = 86400
/** Robust z beyond this is an outlier (Iglewicz–Hoaglin). */
const OUTLIER_Z = 3.5
/** Fewer valid rows than this say nothing about spread. */
const MIN_FOR_SPREAD = 5

export type RowFlag = WeightReason | 'outlier' | 'out-of-range' | 'unlisted-endpoint'

/** Chip label and the rule behind it, so every flag can be re-derived by hand. */
export const FLAG_INFO: Record<RowFlag, { label: string; rule: string }> = {
  revoked: { label: 'revoked', rule: 'Revoked by its author; counts nowhere.' },
  self: { label: 'self', rule: 'Client is the agent owner or agent wallet; weight 0.' },
  duplicate: { label: 'duplicate', rule: 'Same (value, tag1, tag2, endpoint) as a newer feedback by the same client; the older repeat weighs 0.' },
  burst: { label: 'burst', rule: 'More than 2 feedback from this client within 24h; weight × exp(−(N−2)).' },
  monotonous: { label: 'monotonous', rule: 'Client left 3+ feedback, all with the same value; weight × 0.4.' },
  hyperactive: { label: 'hyperactive', rule: 'Client left more than 5 feedback; weight × 0.7.' },
  outlier: { label: 'outlier', rule: `Robust z = (value − median) / (1.4826 · MAD) beyond ±${OUTLIER_Z}.` },
  'out-of-range': { label: 'off-scale', rule: 'Rating outside the scale inferred for its tag; listed, never scored.' },
  'unlisted-endpoint': { label: 'unlisted endpoint', rule: 'Endpoint is not one the registration file advertises.' },
}

export type RowStats = {
  /** Authenticity weight in [0,1] — the row's share of a full vote. */
  weight: number
  flags: RowFlag[]
  /** What the value means; only `rating` enters the score. */
  kind: Kind
  /** Rating normalised to [0,1]; null for every other kind and for ratings off their scale. */
  rating: number | null
  /** Robust z against the valid rows; null when there is too little spread to judge. */
  deviation: number | null
  /** Rows this client left on this agent, revoked included. */
  clientRows: number
}

export type ReviewerStats = {
  client: Address
  rows: number
  revoked: number
  /** Over its non-revoked rows, raw values of every kind. */
  average: number | null
  min: number | null
  max: number | null
  /** Rating rows only, normalised to 0–100. */
  ratingRows: number
  ratingAverage: number | null
  ratingMin: number | null
  ratingMax: number | null
  /** Share of all non-revoked rows — its pull on the on-chain average. */
  share: number
  /** Share of the total authenticity weight — its pull on the weighted score. */
  weightShare: number | null
  first?: number
  last?: number
  /** Raw average without this client minus the raw average with it. */
  shiftWithout: number | null
  /** Normalised rating average without this client minus with it, in 0–100 points. */
  ratingShiftWithout: number | null
  flags: RowFlag[]
}

export type RiskLevel = 'high' | 'warn' | 'info'

export type RiskSignal = { level: RiskLevel; code: string; text: string }

export type FeedbackStats = {
  /** Parallel to the input rows. */
  rows: RowStats[]
  /** Most rows first. */
  reviewers: ReviewerStats[]
  /** Worst first. */
  signals: RiskSignal[]
  level: RiskLevel | 'clean'
  /** How many rows carry each piece of evidence. */
  coverage: { total: number; dated: number; withTx: number; withUri: number; withEndpoint: number }
}

export type StatsContext = {
  owner?: Address | null
  agentWallet?: Address | null
  /** Endpoints the registration file advertises; undefined = file not known. */
  services?: string[]
  /** Unix seconds; defaults to the clock. */
  now?: number
}

function normEndpoint(value: string): string {
  return value.trim().toLowerCase().replace(/\/+$/, '')
}

function average(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null
}

/** median and scale for a robust z; scale null when the values do not spread. */
function robustScale(xs: number[]): { center: number; scale: number | null } | null {
  const center = medianOf(xs)
  if (center === null || xs.length < MIN_FOR_SPREAD) return null
  const abs = xs.map((x) => Math.abs(x - center))
  const mad = medianOf(abs) ?? 0
  // MAD is 0 when over half the rows agree; fall back to the mean absolute deviation.
  const scale = mad > 0 ? 1.4826 * mad : 1.2533 * (average(abs) ?? 0)
  return { center, scale: scale > 0 ? scale : null }
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

const LEVEL_ORDER: Record<RiskLevel, number> = { high: 0, warn: 1, info: 2 }

/**
 * Per-row checks, per-reviewer breakdown and risk signals over one agent's
 * feedback. Every number is a count or mean of the rows shown, so it can be
 * re-derived from the table.
 */
export function computeFeedbackStats(feedback: Feedback[], context: StatsContext = {}): FeedbackStats {
  const now = context.now ?? Math.floor(Date.now() / 1000)
  const self = [context.owner, context.agentWallet].filter((a): a is Address => Boolean(a))
  const selves = new Set(self.map((a) => a.toLowerCase()))
  const isSelf = (row: Feedback): boolean => selves.has(row.client.toLowerCase())
  const { weights, reasons } = computeWeights(feedback, self)
  // Scales come from rows that can be scored: a self-review must not change
  // how every other wallet's value is read on the tag.
  const scaleRows = feedback.filter((f) => !f.revoked && !isSelf(f))
  const { rows: classified } = classify(feedback, { scales: inferTagScales(scaleRows) })
  const services = context.services?.map(normEndpoint).filter(Boolean)

  const valid = feedback.filter((f) => !f.revoked)
  const counted = valid.filter((f) => !isSelf(f))
  const values = valid.map((f) => f.value)
  // Spread, outliers and trend signals are about the quality score, so they
  // read normalised ratings only: a $12,000 revenue row is not a rating
  // outlier next to a 90/100 review.
  const ratingIndexes = classified.flatMap((c, i) =>
    !feedback[i].revoked && c.kind === 'rating' && c.r !== null && !isSelf(feedback[i]) ? [i] : [],
  )
  const ratingByIndex = new Map(ratingIndexes.map((i) => [i, (classified[i].r as number) * 100]))
  const ratingValues = ratingIndexes.map((i) => ratingByIndex.get(i)!)
  const spread = robustScale(ratingValues)
  const range = ratingValues.length ? Math.max(...ratingValues) - Math.min(...ratingValues) : 0
  const material = Math.max(0.2 * range, 0.1 * Math.max(0, ...ratingValues))
  const rawAverage = average(values)
  const ratingAverage = average(ratingValues)
  const totalWeight = weights.reduce((a, b) => a + b, 0)

  const byClient = new Map<string, number[]>()
  feedback.forEach((f, i) => {
    const key = f.client.toLowerCase()
    const rows = byClient.get(key)
    if (rows) rows.push(i)
    else byClient.set(key, [i])
  })
  const ratingsByClient = new Map<string, number[]>()
  for (const i of ratingIndexes) {
    const key = feedback[i].client.toLowerCase()
    const list = ratingsByClient.get(key)
    if (list) list.push((classified[i].r as number) * 100)
    else ratingsByClient.set(key, [(classified[i].r as number) * 100])
  }

  const rows: RowStats[] = feedback.map((f, i) => {
    const flags: RowFlag[] = [...reasons[i]]
    const isRating = classified[i].kind === 'rating' && classified[i].r !== null
    const selfRow = isSelf(f)
    const deviation = isRating && !selfRow && !f.revoked && spread?.scale ? ((classified[i].r as number) * 100 - spread.center) / spread.scale : null
    if (!f.revoked) {
      if (deviation !== null && Math.abs(deviation) > OUTLIER_Z) flags.push('outlier')
      if (!selfRow && classified[i].kind === 'rating' && classified[i].r === null) flags.push('out-of-range')
      if (services && f.endpoint) {
        const endpoint = normEndpoint(f.endpoint)
        if (!services.some((s) => endpoint === s || endpoint.startsWith(`${s}/`))) flags.push('unlisted-endpoint')
      }
    }
    return {
      weight: weights[i],
      flags,
      kind: classified[i].kind,
      rating: classified[i].r,
      deviation,
      clientRows: byClient.get(f.client.toLowerCase())!.length,
    }
  })

  const reviewers: ReviewerStats[] = [...byClient.values()]
    .map((indexes) => {
      const live = indexes.filter((i) => !feedback[i].revoked)
      const own = live.map((i) => feedback[i].value)
      const ownRatings = ratingsByClient.get(feedback[indexes[0]].client.toLowerCase()) ?? []
      const dates = indexes.map((i) => feedback[i].createdAt).filter((t): t is number => t !== undefined)
      const others = valid.length - live.length
      const sum = own.reduce((a, b) => a + b, 0)
      const ratingSum = ownRatings.reduce((a, b) => a + b, 0)
      const otherRatings = ratingValues.length - ownRatings.length
      const weight = indexes.reduce((a, i) => a + weights[i], 0)
      return {
        client: feedback[indexes[0]].client,
        rows: indexes.length,
        revoked: indexes.length - live.length,
        average: average(own),
        min: own.length ? Math.min(...own) : null,
        max: own.length ? Math.max(...own) : null,
        ratingRows: ownRatings.length,
        ratingAverage: average(ownRatings),
        ratingMin: ownRatings.length ? Math.min(...ownRatings) : null,
        ratingMax: ownRatings.length ? Math.max(...ownRatings) : null,
        share: valid.length ? live.length / valid.length : 0,
        weightShare: totalWeight > 0 ? weight / totalWeight : null,
        ...(dates.length ? { first: Math.min(...dates), last: Math.max(...dates) } : {}),
        shiftWithout:
          rawAverage !== null && live.length > 0 && others > 0
            ? (rawAverage * valid.length - sum) / others - rawAverage
            : null,
        ratingShiftWithout:
          ratingAverage !== null && ownRatings.length > 0 && otherRatings > 0
            ? (ratingAverage * ratingValues.length - ratingSum) / otherRatings - ratingAverage
            : null,
        flags: [...new Set(indexes.flatMap((i) => reasons[i]))].filter((flag) => flag !== 'revoked'),
      }
    })
    .sort((a, b) => b.rows - a.rows || b.share - a.share)

  const signals: RiskSignal[] = []
  const count = (flag: RowFlag) => rows.filter((row) => row.flags.includes(flag)).length

  const selfRows = count('self')
  if (selfRows > 0) {
    signals.push({ level: 'high', code: 'self', text: `${selfRows} feedback from the agent's own owner or wallet` })
  }

  const top = [...reviewers].sort((a, b) => b.share - a.share)[0]
  if (top && valid.length >= 3 && top.share >= 0.5) {
    signals.push({
      level: top.share >= 0.8 ? 'high' : 'warn',
      code: 'concentration',
      text: `${shortAddress(top.client)} wrote ${Math.round(top.share * valid.length)} of ${valid.length} counted feedback (${Math.round(top.share * 100)}%)`,
    })
  }

  const swing = reviewers
    .filter((r) => r.ratingShiftWithout !== null)
    .sort((a, b) => Math.abs(b.ratingShiftWithout!) - Math.abs(a.ratingShiftWithout!))[0]
  if (swing && ratingAverage !== null && range > 0 && Math.abs(swing.ratingShiftWithout!) >= material) {
    signals.push({
      level: 'warn',
      code: 'fragile',
      text: `Without ${shortAddress(swing.client)} the rating average moves ${formatScore(ratingAverage)} → ${formatScore(ratingAverage + swing.ratingShiftWithout!)}`,
    })
  }

  // The old "discounted" signal described the legacy row weights, which do
  // not drive the filtered score. Replace it with the actual score coverage,
  // over rows that could score at all: self-reviews are excluded, not counted
  // as unscored telemetry.
  if (counted.length >= 3 && ratingIndexes.length / counted.length < 0.5) {
    signals.push({
      level: 'info',
      code: 'unscored',
      text: `${counted.length - ratingIndexes.length} of ${counted.length} counted feedback are not scored ratings (telemetry, outcomes, metrics, untagged or off-scale)`,
    })
  }

  const dated = valid.filter((f): f is Feedback & { createdAt: number } => f.createdAt !== undefined)
  const agedRatingIndexes = (from: number, to: number): number[] =>
    ratingIndexes.filter((i) => {
      const at = feedback[i].createdAt
      return at !== undefined && now - at >= from && now - at < to
    })
  const lastWeek = agedRatingIndexes(0, 7 * DAY).length
  const weeklyBefore = agedRatingIndexes(7 * DAY, 35 * DAY).length / 4
  if (lastWeek >= 3 && lastWeek > 3 * weeklyBefore) {
    signals.push({
      level: 'warn',
      code: 'surge',
      text: `${lastWeek} scored ratings in the last 7 days vs ${formatScore(weeklyBefore)} per week over the 4 weeks before`,
    })
  }

  const revoked = feedback.length - valid.length
  if (revoked >= 2 && revoked / feedback.length >= 0.2) {
    signals.push({ level: 'warn', code: 'revocations', text: `${revoked} of ${feedback.length} feedback were revoked` })
  }

  const recent = agedRatingIndexes(0, 30 * DAY).map((i) => ratingByIndex.get(i)!)
  const earlier = agedRatingIndexes(30 * DAY, Infinity).map((i) => ratingByIndex.get(i)!)
  if (recent.length >= 2 && earlier.length >= 2 && range > 0) {
    const recentAverage = average(recent)!
    const earlierAverage = average(earlier)!
    if (recentAverage - earlierAverage <= -material) {
      signals.push({
        level: 'warn',
        code: 'decline',
        text: `Last 30 days rating average ${formatScore(recentAverage)} (n=${recent.length}) vs ${formatScore(earlierAverage)} before (n=${earlier.length})`,
      })
    }
  }

  const offScale = count('out-of-range')
  if (offScale > 0) signals.push({ level: 'info', code: 'off-scale', text: `${plural(offScale, 'rating')} outside the scale inferred for the tag` })
  const outliers = count('outlier')
  if (outliers > 0) {
    signals.push({ level: 'info', code: 'outliers', text: `${plural(outliers, 'rating')} far from the other ratings (robust z beyond ±${OUTLIER_Z})` })
  }
  const unlisted = count('unlisted-endpoint')
  if (unlisted > 0) {
    signals.push({
      level: 'info',
      code: 'unlisted-endpoint',
      text: `${plural(unlisted, 'feedback item')} name an endpoint the registration file does not advertise`,
    })
  }
  if (counted.length > 0 && dated.length < counted.length) {
    signals.push({
      level: 'info',
      code: 'undated',
      text: `${counted.length - dated.length} of ${counted.length} counted feedback have no date; burst, surge and trend checks skip them`,
    })
  }

  signals.sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level])

  return {
    rows,
    reviewers,
    signals,
    level: signals[0]?.level ?? 'clean',
    coverage: {
      total: feedback.length,
      dated: feedback.filter((f) => f.createdAt !== undefined).length,
      withTx: feedback.filter((f) => f.txHash).length,
      withUri: feedback.filter((f) => f.feedbackURI).length,
      withEndpoint: feedback.filter((f) => f.endpoint).length,
    },
  }
}
