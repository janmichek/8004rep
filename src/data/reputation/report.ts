import type { Feedback } from '../types'
import { KIND_INFO, type Kind } from './kinds'
import { filteredScore, type Confidence } from './score'
import { buildRatingLayer, HALF_LIFE_DAYS, median, UNIT_WINDOW_DAYS, type RatingLayer } from './units'

export const FORMULA_VERSION = 'rep-1.0'

export type ReportStep = {
  id: string
  label: string
  rule: string
  /** 0–100; null once nothing is left. */
  average: number | null
  rows: number
  delta: number | null
}

export type TelemetrySummary = {
  tag: string
  label: string
  rows: number
  clients: number
  latest: number | null
  median: number | null
}

export type Finding = {
  level: 'warn' | 'info'
  code: 'repeat' | 'template' | 'revocations' | 'review-bomb' | 'same-tx' | 'burst'
  text: string
}

/** One reviewer wallet's actual pull on the filtered score. */
export type WalletContribution = {
  client: string
  /** Capped wallet weight, in full votes. */
  weight: number
  /** Share of the total wallet weight. */
  share: number
  /** Normalised wallet rating, 0–1. */
  rating: number
  /** Filtered score without this wallet minus with it, in 0–100 points. */
  without: number | null
}

export type Responsiveness = {
  /** Ratings at or below half of their scale. */
  lowRatings: number
  /** How many of those carry at least one response. */
  responded: number
  share: number | null
  medianLagDays: number | null
  /** Responses from the owner, agent wallet or someone else. */
  ownerReplies: number
  thirdPartyReplies: number
}

export type ReputationReport = {
  formulaVersion: typeof FORMULA_VERSION
  params: {
    unitWindowDays: number
    halfLifeDays: number
    alpha0: number
    mu0: number
    fakeTarget: number
  }
  /** 0–100 filtered score; null when the agent has no rating units. */
  score: number | null
  /** 80% Beta interval, 0–100. */
  interval: [number, number] | null
  confidence: Confidence
  unrated: boolean
  /** Plain mean of every non-revoked row, 0–100 (the registry's raw number). */
  raw: number | null
  /** Plain mean of the normalised rating rows only (excluding self-reviews), 0–100. */
  rawRatings: number | null
  /** rawRatings − score. Large positive = the rules removed inflation. */
  inflation: number | null
  /** Fresh unlinked wallets needed to force the score to the fake target. */
  cost: number | null
  funnel: {
    feedback: number
    ratedRows: number
    wallets: number
    units: number
    walletsAfterCap: number
  }
  concentration: {
    top1: number
    top3: number
    neff: number
    maxInfluence: number
    /** The same three numbers before unit collapsing, one row = one vote. */
    rawTop1: number
    rawTop3: number
    rawNeff: number
  }
  /** Per-wallet shares and leave-one-out pull on the filtered score. */
  contributions: WalletContribution[]
  /** Ratings per calendar day: the busiest day and how far it stands out. */
  burst: { maxDayRows: number; activeDays: number; ratio: number | null }
  /** Share of rating rows that share a transaction with another rating row. */
  sameTxShare: number | null
  counts: RatingLayer['counts']
  byKind: { kind: Kind; label: string; rows: number }[]
  /** Non-rating rows grouped by tag, the telemetry panel. */
  telemetry: TelemetrySummary[]
  findings: Finding[]
  responsiveness: Responsiveness
  layer: RatingLayer
  waterfall: ReportStep[]
}

const KIND_ORDER: Kind[] = ['rating', 'outcome', 'telemetry', 'metric', 'unknown']

function mean(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null
}

function weightedMean(values: number[], weights: number[]): number | null {
  const total = weights.reduce((a, b) => a + b, 0)
  return total > 0 ? values.reduce((a, x, i) => a + x * weights[i], 0) / total : null
}

function pct(x: number | null): number | null {
  return x === null ? null : x * 100
}

/**
 * The whole classic reputation view from one pass: kinds, rating units,
 * wallet caps, filtered score, inflation gap, funnel, concentration, telemetry.
 * Every number is re-derivable from the rows the page already holds.
 */
export function buildReputationReport(
  feedback: Feedback[],
  opts: { self?: readonly string[]; now?: number } = {},
): ReputationReport {
  const layer = buildRatingLayer(feedback, opts)
  const score = filteredScore(layer.wallets)

  const selves = new Set((opts.self ?? []).map((a) => a.toLowerCase()))
  const valid = feedback.filter((f) => !f.revoked)
  const rawAll = mean(feedback.map((f) => f.value))
  const raw = mean(valid.map((f) => f.value))
  const ratingRowsAll = layer.classified.flatMap((c, i) => (!feedback[i].revoked && c.kind === 'rating' && c.r !== null ? [c.r] : []))
  const ratingRows = layer.classified.flatMap((c, i) =>
    !feedback[i].revoked && c.kind === 'rating' && c.r !== null && !selves.has(feedback[i].client.toLowerCase()) ? [c.r] : [],
  )
  const rawRatings = mean(ratingRows)
  const rawRatingsAll = mean(ratingRowsAll)
  const inflation = rawRatings !== null && score.value !== null ? (rawRatings - score.value) * 100 : null

  const totalEmpty = layer.units.length === 0
  const walletsAfterCap = layer.wallets.filter((w) => w.weight > 0).length
  const capped = weightedMean(layer.wallets.map((w) => w.r), layer.wallets.map((w) => w.weight))
  const unitMean = mean(layer.units.map((u) => u.r))

  const steps: ReportStep[] = []
  const push = (id: string, label: string, rule: string, average: number | null, rows: number) => {
    const before = steps.at(-1)?.average ?? null
    steps.push({
      id,
      label,
      rule,
      average,
      rows,
      delta: before !== null && average !== null ? average - before : null,
    })
  }
  push('all', 'Every review', 'Plain mean of all values, revoked included.', rawAll, feedback.length)
  push('revoked', 'Drop revoked', 'Reviews their author revoked count nowhere.', raw, valid.length)
  push(
    'ratings',
    'Ratings only',
    'Latency, uptime, revenue, pass flags and unknown tags are listed, never averaged into the score.',
    pct(rawRatingsAll),
    ratingRowsAll.length,
  )
  push(
    'self',
    'Drop self-reviews',
    'Feedback from the agent owner or agent wallet is listed, but never enters its score.',
    pct(rawRatings),
    ratingRows.length,
  )
  push(
    'units',
    'One unit per reviewer per tag per 30 days',
    'A burst of repeats collapses to its median, so volume is not a voice.',
    pct(unitMean),
    ratingRows.length,
  )
  push(
    'cap',
    'Cap each wallet at one full vote',
    'A wallet is min(1, Σ 2^(−age/90d)); extra units of the same wallet add no more weight.',
    pct(capped),
    walletsAfterCap,
  )
  push(
    'prior',
    'Add a neutral prior',
    'Three unverified wallets at 50/100 pull a thin record toward the middle instead of the extremes.',
    totalEmpty ? null : pct(score.value),
    ratingRows.length,
  )

  const telemetry = new Map<string, { label: string; rows: number; clients: Set<string>; values: { value: number; at?: number }[] }>()
  layer.classified.forEach((c, i) => {
    const f = feedback[i]
    if (f.revoked || c.kind !== 'telemetry') return
    let hit = telemetry.get(c.tag)
    if (!hit) {
      hit = { label: f.tag1?.trim() || '(no tag)', rows: 0, clients: new Set(), values: [] }
      telemetry.set(c.tag, hit)
    }
    hit.rows++
    hit.clients.add(f.client.toLowerCase())
    hit.values.push({ value: f.value, at: f.createdAt })
  })

  const ratingIdx = layer.classified.flatMap((c, i) =>
    !feedback[i].revoked && c.kind === 'rating' && c.r !== null && !selves.has(feedback[i].client.toLowerCase()) ? [i] : [],
  )
  const perClientRows = new Map<string, number>()
  for (const i of ratingIdx) {
    const key = feedback[i].client.toLowerCase()
    perClientRows.set(key, (perClientRows.get(key) ?? 0) + 1)
  }
  const maxWalletRows = Math.max(0, ...perClientRows.values())
  const findings: Finding[] = []
  if (ratingIdx.length >= 5 && maxWalletRows / ratingIdx.length >= 0.5 && maxWalletRows >= 5) {
    findings.push({
      level: 'warn',
      code: 'repeat',
      text: `One wallet wrote ${maxWalletRows} of the ${ratingIdx.length} rating rows (${Math.round((maxWalletRows / ratingIdx.length) * 100)}%); it still holds one vote.`,
    })
  }
  const extremes = ratingIdx.filter((i) => (layer.classified[i].r as number) >= 0.99 || (layer.classified[i].r as number) <= 0.01)
  if (ratingIdx.length >= 5 && extremes.length / ratingIdx.length >= 0.7) {
    findings.push({
      level: 'warn',
      code: 'template',
      text: `${extremes.length} of ${ratingIdx.length} ratings sit at the very top or bottom of their scale; a locked template cannot tell good agents from great ones.`,
    })
  }
  const perTx = new Map<string, number>()
  for (const i of ratingIdx) {
    const hash = feedback[i].txHash
    if (hash) perTx.set(hash, (perTx.get(hash) ?? 0) + 1)
  }
  const groupedRows = [...perTx.values()].reduce((a, n) => a + n, 0)
  const repeatedRows = [...perTx.values()].filter((n) => n > 1).reduce((a, n) => a + n, 0)
  const sameTxShare = groupedRows ? repeatedRows / groupedRows : null
  if (sameTxShare !== null && ratingIdx.length >= 5 && sameTxShare >= 0.3) {
    findings.push({
      level: 'warn',
      code: 'same-tx',
      text: `${Math.round(sameTxShare * 100)}% of rating rows share a transaction with another rating; one transaction cannot be an independent opinion.`,
    })
  }

  const perDay = new Map<number, number>()
  for (const i of ratingIdx) {
    const at = feedback[i].createdAt
    if (at !== undefined) {
      const day = Math.floor(at / 86400)
      perDay.set(day, (perDay.get(day) ?? 0) + 1)
    }
  }
  const maxDayRows = Math.max(0, ...perDay.values())
  const activeDays = perDay.size
  const datedRatingRows = ratingIdx.filter((i) => feedback[i].createdAt !== undefined).length
  const burstRatio = activeDays > 1 && datedRatingRows >= 10 ? maxDayRows / (datedRatingRows / activeDays) : null
  if (burstRatio !== null && burstRatio >= 5) {
    findings.push({
      level: 'warn',
      code: 'burst',
      text: `${maxDayRows} of ${datedRatingRows} dated ratings landed on one day (${burstRatio.toFixed(1)}× the active-day average); a burst is not steady demand.`,
    })
  }
  const lows = ratingIdx.filter((i) => (layer.classified[i].r as number) <= 0.2)
  if (lows.length >= 3 && lows.length / ratingIdx.length >= 0.5) {
    findings.push({
      level: 'warn',
      code: 'review-bomb',
      text: `${lows.length} of ${ratingIdx.length} ratings sit at the bottom of their scale; check the Reviewers tab for a coordinated run.`,
    })
  }
  if (layer.counts.revoked >= 2 && layer.counts.revoked / Math.max(1, feedback.length) >= 0.2) {
    findings.push({
      level: 'warn',
      code: 'revocations',
      text: `${layer.counts.revoked} of ${feedback.length} rows were revoked; a revoked low followed by a high replacement is a common wash.`,
    })
  }

  const lowIdx = ratingIdx.filter((i) => (layer.classified[i].r as number) <= 0.5)
  const responders = feedback.flatMap((f, i) => (lowIdx.includes(i) ? (f.responses ?? []) : []))
  const ownerReplies = responders.filter((r) => (opts.self ?? []).some((a) => a.toLowerCase() === r.responder.toLowerCase())).length
  const lags = lowIdx.flatMap((i) => {
    const f = feedback[i]
    // Time to the first answer, not to every later reply: a second reply does
    // not make the owner slower to respond.
    const first = (f.responses ?? [])
      .map((r) => r.createdAt)
      .filter((t): t is number => t !== undefined)
      .sort((a, b) => a - b)[0]
    return f.createdAt !== undefined && first !== undefined ? [(first - f.createdAt) / 86400] : []
  })
  const responsiveness: Responsiveness = {
    lowRatings: lowIdx.length,
    responded: new Set(lowIdx.filter((i) => (feedback[i].responses ?? []).length > 0)).size,
    share: lowIdx.length ? lowIdx.filter((i) => (feedback[i].responses ?? []).length > 0).length / lowIdx.length : null,
    medianLagDays: median(lags),
    ownerReplies,
    thirdPartyReplies: responders.length - ownerReplies,
  }

  const rawShare = (k: number) => {
    const sorted = [...perClientRows.values()].sort((a, b) => b - a)
    return sorted.slice(0, k).reduce((a, n) => a + n, 0) / (ratingIdx.length || 1)
  }
  const rawNeff = ratingIdx.length ? ratingIdx.length ** 2 / [...perClientRows.values()].reduce((a, n) => a + n * n, 0) : 0

  // Exact leave-one-out posterior mean: removing a wallet subtracts its weight
  // from both Beta parameters, so no matrix or re-fit is needed.
  const contributions: WalletContribution[] = layer.wallets
    .map((w) => {
      const share = score.totalWeight > 0 ? w.weight / score.totalWeight : 0
      const denominator = score.alpha + score.beta - w.weight
      const without = score.value !== null && denominator > 0 ? (score.alpha - w.weight * w.r) / denominator : null
      return {
        client: w.client,
        weight: w.weight,
        share,
        rating: w.r,
        without: without !== null && score.value !== null ? (without - score.value) * 100 : null,
      }
    })
    .sort((a, b) => b.weight - a.weight || b.share - a.share)

  return {
    formulaVersion: FORMULA_VERSION,
    params: { unitWindowDays: UNIT_WINDOW_DAYS, halfLifeDays: HALF_LIFE_DAYS, alpha0: 3, mu0: 0.5, fakeTarget: 0.9 },
    score: pct(score.value),
    interval: score.interval ? [score.interval[0] * 100, score.interval[1] * 100] : null,
    confidence: score.confidence,
    unrated: score.unrated,
    raw,
    rawRatings: pct(rawRatings),
    inflation,
    cost: score.cost,
    funnel: {
      feedback: feedback.length,
      ratedRows: layer.units.reduce((a, u) => a + u.rows.length, 0),
      wallets: layer.wallets.length,
      units: layer.units.length,
      walletsAfterCap,
    },
    concentration: {
      top1: score.top1,
      top3: [...layer.wallets]
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 3)
        .reduce((a, w) => a + w.weight, 0) / (score.totalWeight || 1),
      neff: score.neff,
      maxInfluence: score.maxInfluence,
      rawTop1: rawShare(1),
      rawTop3: rawShare(3),
      rawNeff,
    },
    contributions,
    burst: { maxDayRows, activeDays, ratio: burstRatio },
    sameTxShare,
    counts: layer.counts,
    byKind: KIND_ORDER.map((kind) => ({
      kind,
      label: KIND_INFO[kind].label,
      rows: layer.classified.filter((c, i) => !feedback[i].revoked && c.kind === kind).length,
    })),
    telemetry: [...telemetry.entries()]
      .map(([tag, t]) => {
        const timed = t.values.filter((v): v is { value: number; at: number } => v.at !== undefined).sort((a, b) => b.at - a.at)
        return {
          tag,
          label: t.label,
          rows: t.rows,
          clients: t.clients.size,
          latest: timed[0]?.value ?? t.values.at(-1)?.value ?? null,
          median: median(t.values.map((v) => v.value)),
        }
      })
      .sort((a, b) => b.rows - a.rows),
    findings,
    responsiveness,
    layer,
    waterfall: steps,
  }
}
