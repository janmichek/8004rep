import type { Address } from 'viem'
import { classify } from './reputation/kinds'
import type { FeedbackEvent } from './types'

const DAY = 86400

/** Rows needed before a rating habit says anything. */
export const MIN_PATTERN_ROWS = 5
/** Share of rows on one value above which a reviewer is a rubber stamp. */
export const STAMP_SHARE = 0.9
/** Rows within 24h at or above which a reviewer writes in bulk. */
export const BULK_PER_DAY = 10
/** Agents rated at or above which a reviewer is a mass reviewer. */
export const MASS_AGENTS = 10
/** Average at or below which a reviewer is harsh (possible review bombing). */
export const HARSH_AVERAGE = 30

export type ReviewerLabel = 'rubber-stamp' | 'single-agent' | 'bulk' | 'mass' | 'harsh'

/** Chip text, the rule behind it, and how much it should worry a reader. */
export const LABEL_INFO: Record<ReviewerLabel, { label: string; rule: string; tone: 'warn' | 'info' }> = {
  'rubber-stamp': {
    label: 'rubber stamp',
    rule: `${MIN_PATTERN_ROWS}+ scored ratings and at least ${STAMP_SHARE * 100}% of them carry the same normalised value.`,
    tone: 'warn',
  },
  'single-agent': { label: 'one agent only', rule: '3+ reviews, every one on the same agent.', tone: 'warn' },
  bulk: { label: 'bulk writer', rule: `${BULK_PER_DAY}+ reviews within one 24h window.`, tone: 'warn' },
  mass: { label: 'mass reviewer', rule: `Rated ${MASS_AGENTS}+ different agents.`, tone: 'info' },
  harsh: { label: 'harsh', rule: `${MIN_PATTERN_ROWS}+ scored ratings averaging ${HARSH_AVERAGE}/100 or less.`, tone: 'info' },
}

export type AgentShare = {
  tokenId: bigint
  chainId?: number
  agentName?: string
  rows: number
  average: number | null
  /** Scored ratings on this agent only, normalised to 0–100. */
  ratingAverage: number | null
  revoked: number
}

export type ReviewerProfile = {
  address: Address
  rows: number
  revoked: number
  agents: number
  /** Over non-revoked rows, raw values of every kind. */
  average: number | null
  /** Most common raw value and its share of non-revoked rows. */
  mode: { value: number; share: number } | null
  /** Scored rating rows only, normalised to 0–100. */
  ratingRows: number
  ratingAverage: number | null
  /** Most common normalised rating and its share of scored ratings, 0–100. */
  ratingMode: { value: number; share: number } | null
  first?: number
  last?: number
  /** Most rows inside any 24h window. */
  peakPerDay: number
  /** Most rows first. */
  perAgent: AgentShare[]
  /** Networks the rows came from, most rows first; empty when rows carry no chain. */
  chainIds: number[]
  labels: ReviewerLabel[]
}

function mean(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null
}

/** Most rows within any window of `span` seconds over sorted times. */
export function peakWithin(times: number[], span: number): number {
  const sorted = [...times].sort((a, b) => a - b)
  let best = 0
  let start = 0
  for (let end = 0; end < sorted.length; end++) {
    while (sorted[end] - sorted[start] > span) start++
    best = Math.max(best, end - start + 1)
  }
  return best
}

/** What one address's feedback, across agents, says about how it reviews. */
export function buildReviewerProfile(address: Address, rows: FeedbackEvent[]): ReviewerProfile {
  const live = rows.filter((r) => !r.revoked)
  const values = live.map((r) => r.value)
  const counts = new Map<number, number>()
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
  const mode = top ? { value: top[0], share: top[1] / values.length } : null
  const dates = rows.map((r) => r.createdAt).filter((t): t is number => t !== undefined)

  // Token IDs repeat across chains, so an agent is (chain, token).
  const byAgent = new Map<string, FeedbackEvent[]>()
  for (const r of rows) {
    const key = `${r.chainId ?? ''}:${r.tokenId}`
    const group = byAgent.get(key)
    if (group) group.push(r)
    else byAgent.set(key, [r])
  }
  const ratingValues: number[] = []
  const perAgent: AgentShare[] = [...byAgent.values()]
    .map((group) => {
      const ok = group.filter((r) => !r.revoked)
      // Normalise on each agent's own tag scale, then pool the ratings: a
      // reviewer's 5/5 and 100/100 are the same habit, not 5 and 100.
      const { rows: rated } = classify(ok)
      const agentRatings = rated.flatMap((c) => (c.kind === 'rating' && c.r !== null ? [c.r * 100] : []))
      ratingValues.push(...agentRatings)
      const name = group.find((r) => r.agentName)?.agentName
      const chainId = group[0].chainId
      return {
        tokenId: group[0].tokenId,
        ...(chainId !== undefined ? { chainId } : {}),
        ...(name ? { agentName: name } : {}),
        rows: group.length,
        average: mean(ok.map((r) => r.value)),
        ratingAverage: mean(agentRatings),
        revoked: group.length - ok.length,
      }
    })
    .sort((a, b) => b.rows - a.rows || (a.tokenId < b.tokenId ? -1 : 1))

  const average = mean(values)
  const ratingCounts = new Map<number, number>()
  for (const v of ratingValues) ratingCounts.set(v, (ratingCounts.get(v) ?? 0) + 1)
  const topRating = [...ratingCounts.entries()].sort((a, b) => b[1] - a[1])[0]
  const ratingMode = topRating && ratingValues.length ? { value: topRating[0], share: topRating[1] / ratingValues.length } : null
  const ratingAverage = mean(ratingValues)
  const peakPerDay = peakWithin(dates, DAY)
  const perChain = new Map<number, number>()
  for (const r of rows) if (r.chainId !== undefined) perChain.set(r.chainId, (perChain.get(r.chainId) ?? 0) + 1)
  const chainIds = [...perChain.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).map(([id]) => id)

  const labels: ReviewerLabel[] = []
  if (ratingMode && ratingValues.length >= MIN_PATTERN_ROWS && ratingMode.share >= STAMP_SHARE) labels.push('rubber-stamp')
  if (rows.length >= 3 && perAgent.length === 1) labels.push('single-agent')
  if (peakPerDay >= BULK_PER_DAY) labels.push('bulk')
  if (perAgent.length >= MASS_AGENTS) labels.push('mass')
  if (ratingAverage !== null && ratingValues.length >= MIN_PATTERN_ROWS && ratingAverage <= HARSH_AVERAGE) labels.push('harsh')

  return {
    address,
    rows: rows.length,
    revoked: rows.length - live.length,
    agents: perAgent.length,
    average,
    mode,
    ratingRows: ratingValues.length,
    ratingAverage,
    ratingMode,
    ...(dates.length ? { first: Math.min(...dates), last: Math.max(...dates) } : {}),
    peakPerDay,
    perAgent,
    chainIds,
    labels,
  }
}

/** Warn labels weigh 2, info labels 1; 0 = nothing notable. */
export function suspicionOf(labels: ReviewerLabel[]): number {
  return labels.reduce((a, l) => a + (LABEL_INFO[l].tone === 'warn' ? 2 : 1), 0)
}
