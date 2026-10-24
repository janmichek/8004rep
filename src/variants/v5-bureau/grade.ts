import { STRONG_REVIEWERS, THIN_REVIEWERS } from '../../data/trustReport'
import type { ReputationSummary } from '../../data/types'
import { letterGrade, type Grade } from '../shared/metrics'

/**
 * Grade from the on-chain summary alone, for lists where the per-row rules
 * cannot run: evidence tier by review count, no risk cap. Marked provisional.
 */
export function provisionalGrade(summary: ReputationSummary | undefined): Grade {
  if (!summary || summary.count === 0) return 'NR'
  const tier = summary.count < THIN_REVIEWERS ? 'thin' : summary.count < STRONG_REVIEWERS ? 'moderate' : 'strong'
  return letterGrade(summary.average, tier, 'clean')
}

export const GRADES: Grade[] = ['A+', 'A', 'B', 'C', 'D', 'F', 'NR']
