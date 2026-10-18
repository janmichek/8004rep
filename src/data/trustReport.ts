import { formatScore, shortAddress } from '../format'
import type { FeedbackStats } from './feedbackStats'
import { computeScores, computeWeights } from './scores'
import type { Feedback } from './types'

export type WaterfallStepId = 'all' | 'revoked' | 'self' | 'duplicate' | 'burst' | 'pattern'

export type WaterfallStep = {
  id: WaterfallStepId
  label: string
  /** The rule applied at this step, in words that can be checked against the rows. */
  rule: string
  /** Weighted average after this step; null once no weight is left. */
  average: number | null
  /** Rows whose weight this step lowered (for `all`: every row). */
  rows: number
  /** Change of the average against the step before; null when either side is null. */
  delta: number | null
}

const STEPS: { id: Exclude<WaterfallStepId, 'all'>; label: string; rule: string }[] = [
  { id: 'revoked', label: 'Drop revoked', rule: 'Rows their author revoked count nowhere.' },
  { id: 'self', label: 'Drop self-reviews', rule: 'Rows from the agent owner or agent wallet weigh 0.' },
  { id: 'duplicate', label: 'Drop duplicates', rule: 'A repeat of an earlier (value, tag1, tag2, endpoint) weighs 0.' },
  { id: 'burst', label: 'Discount bursts', rule: 'More than 2 rows from one client within 24h: × exp(−(N−2)).' },
  {
    id: 'pattern',
    label: 'Discount repeat reviewers',
    rule: 'A client with 3+ rows of one value: × 0.4; with more than 5 rows: × 0.7.',
  },
]

function weightedMean(values: number[], weights: number[]): number | null {
  const total = weights.reduce((a, b) => a + b, 0)
  return total > 0 ? values.reduce((a, x, i) => a + x * weights[i], 0) / total : null
}

/**
 * The weighted score, built up one rule at a time from the plain mean of every
 * row. Applying all steps gives `computeScores(...).weighted`.
 */
export function scoreWaterfall(feedback: Feedback[], self: readonly string[] = []): WaterfallStep[] {
  const values = feedback.map((f) => f.value)
  const current = feedback.map(() => 1)
  const steps: WaterfallStep[] = [
    { id: 'all', label: 'Every row', rule: 'Plain mean of all values, revoked included.', average: weightedMean(values, current), rows: feedback.length, delta: null },
  ]
  if (feedback.length === 0) return steps

  const { reasons, factors } = computeWeights(feedback, self)
  const factorOf: Record<(typeof STEPS)[number]['id'], (i: number) => number> = {
    revoked: (i) => (feedback[i].revoked ? 0 : 1),
    self: (i) => (reasons[i].includes('self') ? 0 : 1),
    duplicate: (i) => factors[i].dup,
    burst: (i) => factors[i].burst,
    pattern: (i) => factors[i].trust,
  }

  for (const step of STEPS) {
    let rows = 0
    current.forEach((w, i) => {
      const factor = factorOf[step.id](i)
      if (w > 0 && factor < 1) rows++
      current[i] = w * factor
    })
    const before = steps.at(-1)!.average
    const average = weightedMean(values, current)
    steps.push({ ...step, average, rows, delta: before !== null && average !== null ? average - before : null })
  }
  return steps
}

export type StrengthTier = 'none' | 'thin' | 'moderate' | 'strong'

export type LadderId = 'bare' | 'context' | 'file'

export type LadderRung = { id: LadderId; label: string; rule: string; rows: number }

export type TrustReport = {
  /** Mean of non-revoked rows — what `getSummary` reports. */
  raw: number | null
  /** Weighted average after every rule. */
  trusted: number | null
  /** Lower confidence bound of the trusted score. */
  lcb: number | null
  strength: { tier: StrengthTier; reasons: string[] }
  waterfall: WaterfallStep[]
  /** Non-revoked rows by the strongest evidence each carries. */
  ladder: LadderRung[]
  /** One plain sentence: score, distance from raw, evidence. */
  headline: string
}

/** Below these the evidence is thin; at or above the strong ones (and no dominant reviewer) it is strong. */
export const THIN_REVIEWERS = 3
export const STRONG_REVIEWERS = 10
/** Largest reviewer's share of the weight above which evidence cannot be strong. */
export const DOMINANT_SHARE = 0.3

const LADDER: Omit<LadderRung, 'rows'>[] = [
  { id: 'bare', label: 'Bare value', rule: 'A number with no tag, endpoint or feedback file.' },
  { id: 'context', label: 'Says what was rated', rule: 'Carries a tag or names an endpoint, but no feedback file.' },
  { id: 'file', label: 'Feedback file', rule: 'Points to an off-chain file (comment, task, payment proof) — open Tx detail to verify it.' },
]

function ladderOf(f: Feedback): LadderId {
  if (f.feedbackURI) return 'file'
  if (f.tag1 || f.tag2 || f.endpoint) return 'context'
  return 'bare'
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

function fmt(value: number): string {
  return formatScore(Number(value.toFixed(1)))
}

function strengthOf(feedback: Feedback[], stats: FeedbackStats, self: readonly string[]): TrustReport['strength'] {
  const scores = computeScores(feedback, { self })
  if (scores.effectiveCount === 0) {
    return { tier: 'none', reasons: [feedback.length ? 'Every row was revoked or weighs 0.' : 'No feedback yet.'] }
  }
  const counted = stats.reviewers.filter((r) => (r.weightShare ?? 0) > 0)
  const independent = scores.clientsEff ?? 0
  const top = [...counted].sort((a, b) => (b.weightShare ?? 0) - (a.weightShare ?? 0))[0]
  const topShare = top?.weightShare ?? 0

  const reasons = [
    counted.length === 1
      ? 'A single reviewer carries all the weight.'
      : `${counted.length} reviewers carry weight, worth ${fmt(independent)} equally weighted voices.`,
    `${fmt(scores.effectiveCount)} full votes after discounts, out of ${plural(scores.nValid, 'counted row')}.`,
  ]
  if (top && topShare >= DOMINANT_SHARE) {
    reasons.push(`The largest reviewer, ${shortAddress(top.client)}, holds ${Math.round(topShare * 100)}% of the weight.`)
  }

  const tier: StrengthTier =
    independent < THIN_REVIEWERS || scores.effectiveCount < THIN_REVIEWERS
      ? 'thin'
      : independent >= STRONG_REVIEWERS && scores.effectiveCount >= STRONG_REVIEWERS && topShare < DOMINANT_SHARE
        ? 'strong'
        : 'moderate'
  return { tier, reasons }
}

const TIER_WORDS: Record<StrengthTier, string> = {
  none: 'no usable evidence',
  thin: 'thin evidence',
  moderate: 'moderate evidence',
  strong: 'strong evidence',
}

export function buildTrustReport(feedback: Feedback[], stats: FeedbackStats, self: readonly string[] = []): TrustReport {
  const scores = computeScores(feedback, { self })
  const waterfall = scoreWaterfall(feedback, self)
  const strength = strengthOf(feedback, stats, self)
  const valid = feedback.filter((f) => !f.revoked)
  const ladder = LADDER.map((rung) => ({ ...rung, rows: valid.filter((f) => ladderOf(f) === rung.id).length }))

  const trusted = scores.weighted
  const raw = scores.raw
  let headline: string
  if (feedback.length === 0) headline = 'No feedback yet.'
  else if (trusted === null) headline = `None of the ${plural(feedback.length, 'row')} carries weight: ${TIER_WORDS.none}.`
  else {
    const gap = raw === null ? 0 : raw - trusted
    const versus = Math.abs(gap) < 0.05 ? 'same as the raw average' : `raw average ${fmt(raw!)}`
    const biggest = waterfall
      .filter((s) => s.id !== 'all' && s.delta !== null && Math.abs(s.delta) >= 0.05)
      .sort((a, b) => Math.abs(b.delta!) - Math.abs(a.delta!))[0]
    headline =
      `Trusted score ${fmt(trusted)} (${versus}) on ${TIER_WORDS[strength.tier]}.` +
      (biggest ? ` Biggest move: ${biggest.label.toLowerCase()} (${biggest.delta! > 0 ? '+' : ''}${fmt(biggest.delta!)}).` : '')
  }

  return { raw, trusted, lcb: scores.lcb, strength, waterfall, ladder, headline }
}

