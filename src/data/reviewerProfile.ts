import type { Address } from 'viem'
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
    rule: `${MIN_PATTERN_ROWS}+ rows and at least ${STAMP_SHARE * 100}% of them carry the same value.`,
    tone: 'warn',
  },
  'single-agent': { label: 'one agent only', rule: '3+ rows, every one on the same agent.', tone: 'warn' },
  bulk: { label: 'bulk writer', rule: `${BULK_PER_DAY}+ rows within one 24h window.`, tone: 'warn' },
  mass: { label: 'mass reviewer', rule: `Rated ${MASS_AGENTS}+ different agents.`, tone: 'info' },
  harsh: { label: 'harsh', rule: `${MIN_PATTERN_ROWS}+ rows averaging ${HARSH_AVERAGE} or less.`, tone: 'info' },
}

export type AgentShare = { tokenId: bigint; agentName?: string; rows: number; average: number | null; revoked: number }

export type ReviewerProfile = {
  address: Address
  rows: number
  revoked: number
  agents: number
  /** Over non-revoked rows. */
  average: number | null
  /** Most common value and its share of non-revoked rows. */
  mode: { value: number; share: number } | null
  first?: number
  last?: number
  /** Most rows inside any 24h window. */
  peakPerDay: number
  /** Most rows first. */
  perAgent: AgentShare[]
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

  const byAgent = new Map<string, FeedbackEvent[]>()
  for (const r of rows) {
    const key = r.tokenId.toString()
    byAgent.set(key, [...(byAgent.get(key) ?? []), r])
  }
  const perAgent: AgentShare[] = [...byAgent.values()]
    .map((group) => {
      const ok = group.filter((r) => !r.revoked)
      const name = group.find((r) => r.agentName)?.agentName
      return {
        tokenId: group[0].tokenId,
        ...(name ? { agentName: name } : {}),
        rows: group.length,
        average: mean(ok.map((r) => r.value)),
        revoked: group.length - ok.length,
      }
    })
    .sort((a, b) => b.rows - a.rows || (a.tokenId < b.tokenId ? -1 : 1))

  const average = mean(values)
  const peakPerDay = peakWithin(dates, DAY)
  const labels: ReviewerLabel[] = []
  if (mode && live.length >= MIN_PATTERN_ROWS && mode.share >= STAMP_SHARE) labels.push('rubber-stamp')
  if (rows.length >= 3 && perAgent.length === 1) labels.push('single-agent')
  if (peakPerDay >= BULK_PER_DAY) labels.push('bulk')
  if (perAgent.length >= MASS_AGENTS) labels.push('mass')
  if (average !== null && live.length >= MIN_PATTERN_ROWS && average <= HARSH_AVERAGE) labels.push('harsh')

  return {
    address,
    rows: rows.length,
    revoked: rows.length - live.length,
    agents: perAgent.length,
    average,
    mode,
    ...(dates.length ? { first: Math.min(...dates), last: Math.max(...dates) } : {}),
    peakPerDay,
    perAgent,
    labels,
  }
}

/** Warn labels weigh 2, info labels 1; 0 = nothing notable. */
export function suspicionOf(labels: ReviewerLabel[]): number {
  return labels.reduce((a, l) => a + (LABEL_INFO[l].tone === 'warn' ? 2 : 1), 0)
}
