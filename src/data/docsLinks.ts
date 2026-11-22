import type { RowFlag } from './feedbackStats'
import type { Kind } from './reputation/kinds'
import type { ReviewerLabel } from './reviewerProfile'

/**
 * Chip and kind ids that are not the docs anchor. The docs ids stay stable;
 * these are the names the rest of the UI already uses.
 */
const ALIAS: Record<string, string> = {
  self: 'self-review',
  'out-of-range': 'off-scale',
  bulk: 'bulk-writer',
  mass: 'mass-reviewer',
}

/** Flag chip → the metric-guide paragraph that states the rule. */
export const FLAG_DOCS: Record<RowFlag, string> = {
  revoked: 'revoked',
  self: 'self-review',
  duplicate: 'duplicate',
  burst: 'burst',
  monotonous: 'monotonous',
  hyperactive: 'hyperactive',
  outlier: 'outlier',
  'out-of-range': 'off-scale',
  'unlisted-endpoint': 'unlisted-endpoint',
}

/** Reviewer label → the metric-guide paragraph that states the rule. */
export const LABEL_DOCS: Record<ReviewerLabel, string> = {
  'rubber-stamp': 'rubber-stamp',
  'single-agent': 'single-agent',
  bulk: 'bulk-writer',
  mass: 'mass-reviewer',
  harsh: 'harsh',
}

/** Value kind → the paragraph that says whether it is scored. */
export const KIND_DOCS: Record<Kind, string> = {
  rating: 'rating-only',
  outcome: 'rating-only',
  telemetry: 'telemetry',
  metric: 'rating-only',
  unknown: 'rating-only',
}

/** Waterfall step on the Overview tab → its docs paragraph. */
export const WATERFALL_DOCS: Record<string, string> = {
  all: 'raw-onchain',
  revoked: 'revoked',
  ratings: 'rating-only',
  self: 'self-review',
  units: 'rating-unit',
  cap: 'wallet-vote',
  prior: 'prior',
}

/**
 * Tx-detail check → the docs paragraph that describes the same idea.
 * A check with no entry would send "More" to the top of the docs.
 */
export const CHECK_DOCS: Record<string, string> = {
  'tx-found': 'coverage',
  'tx-sender': 'self-review',
  'tx-target': 'entity-reputation-registry',
  'tx-single': 'feedback-row',
  'tx-fee': 'cost-to-fake',
  'file-interaction': 'evidence-ladder',
  'file-present': 'entity-feedback-file',
  'file-readable': 'entity-feedback-file',
  'file-integrity': 'evidence-ladder',
  'file-consistent': 'evidence-ladder',
  'pay-cited': 'evidence-ladder',
  'pay-exists': 'evidence-ladder',
  'pay-parties': 'evidence-ladder',
  'pay-order': 'evidence-ladder',
  'pay-unique': 'evidence-ladder',
  'pay-amount': 'evidence-ladder',
  'rev-independent': 'self-review',
  'rev-activity': 'sybil',
  'rev-breadth': 'single-agent',
  'rev-varied': 'rubber-stamp',
  'rev-stands': 'revoked',
  'agent-weight': 'filtered-score',
  'agent-voice': 'top-shares',
  'agent-concentration': 'effective-voices',
  'agent-early': 'sybil',
  'agent-influence': 'max-influence',
  'agent-validation': 'limits',
}

/** Canonical docs anchor for a tooltip id, flag id or `#hash`. */
export function docsAnchor(id: string | undefined | null): string | undefined {
  if (!id) return undefined
  let clean = id.trim()
  if (clean.startsWith('#')) clean = clean.slice(1)
  if (!clean) return undefined
  try {
    clean = decodeURIComponent(clean)
  } catch {
    // Keep the raw fragment when it is not valid percent-encoding.
  }
  if (!clean) return undefined
  return ALIAS[clean] ?? clean
}
