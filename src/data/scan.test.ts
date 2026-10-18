import { describe, expect, it } from 'vitest'
import { parseScanScore, parseScanStats } from './scan'

// Trimmed from GET /agents/1/22771 (2026-10-18).
const AGENT = {
  total_score: 93.73,
  scores: {
    last_scored_at: '2026-10-18T00:50:33.532850+00:00',
    breakdown: {
      version: '5.2',
      algorithm: 'v5_leaderboard_policy',
      dimensions: {
        service: { score: 95, weight: 0.25 },
        momentum: { score: 5, weight: 0.1 },
        publisher: { score: 48.58, weight: 0.2 },
        compliance: { score: 98, weight: 0.15 },
        engagement: { score: 71.37, weight: 0.3, details: { average_score: 97.75, feedback_count: 49, feedback_weight: 1 } },
      },
      leaderboard_policy: { score_band: { floor: 78, ceiling: 95 } },
    },
  },
}

describe('parseScanScore', () => {
  it('reads the total, the dimensions heaviest first, and the feedback inputs', () => {
    const score = parseScanScore(AGENT)!
    expect(score.total).toBe(93.73)
    expect(score.dimensions.map((d) => d.id)).toEqual(['engagement', 'service', 'publisher', 'compliance', 'momentum'])
    expect(score.dimensions[0]).toEqual({ id: 'engagement', label: 'Engagement', score: 71.37, weight: 0.3 })
    expect(score.feedback).toEqual({ average: 97.75, count: 49, weight: 1 })
    expect(score.band).toEqual({ floor: 78, ceiling: 95 })
    expect(score.algorithm).toBe('v5_leaderboard_policy v5.2')
    expect(score.scoredAt).toMatch(/^2026-10-18/)
  })

  it('keeps what it can from a partial or hostile body', () => {
    expect(parseScanScore(null)).toBeNull()
    expect(parseScanScore({ total_score: 'high' })).toBeNull()
    const score = parseScanScore({ total_score: 12, scores: { breakdown: { dimensions: { x: { score: '1', weight: 1 }, y: 7 } } } })
    expect(score).toEqual({ total: 12, dimensions: [] })
  })
})

describe('parseScanStats', () => {
  it('reads the ecosystem baseline', () => {
    expect(parseScanStats({ average_feedback_score: 92.86, total_feedbacks: 4022119, total_agents: 1003923 })).toEqual({
      averageFeedback: 92.86,
      totalFeedback: 4022119,
      totalAgents: 1003923,
    })
    expect(parseScanStats({ average_feedback_score: 92.86 })).toBeNull()
  })
})

describe('parseScanScore unscored', () => {
  it('reads a bare 0 without a breakdown as not scored', () => {
    expect(parseScanScore({ total_score: 0, scores: null })).toBeNull()
  })
})
