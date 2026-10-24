import type { Feedback } from '../../data/types'

export type Result = 'W' | 'D' | 'L' | 'R'

/** One review as a match result: 80+ a win, 50–79 a draw, below a loss; R = revoked. */
export function resultOf(f: Feedback): Result {
  if (f.revoked) return 'R'
  return f.value >= 80 ? 'W' : f.value >= 50 ? 'D' : 'L'
}

export type Tier = 'Gold' | 'Silver' | 'Bronze' | 'Unranked'

/** Tier from the rank score and how many reviews back it. */
export function tierOf(score: number | null, reviews: number): Tier {
  if (score === null || reviews < 3) return 'Unranked'
  return score >= 85 ? 'Gold' : score >= 70 ? 'Silver' : 'Bronze'
}

/** Win / draw / loss tally of a set of reviews. */
export function record(feedback: Feedback[]): Record<Result, number> {
  const out: Record<Result, number> = { W: 0, D: 0, L: 0, R: 0 }
  for (const f of feedback) out[resultOf(f)]++
  return out
}
