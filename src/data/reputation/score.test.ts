import { describe, expect, it } from 'vitest'
import type { Address } from 'viem'
import type { Feedback } from '../types'
import { buildReputationReport } from './report'
import { betaCdf, betaQuantile, robustScore } from './score'
import { buildRatingLayer } from './units'

const DAY = 86400
const NOW = 2_000_000_000

function addr(n: number): Address {
  return `0x${n.toString(16).padStart(40, '0')}` as Address
}

function row(client: Address, value: number, extra: Partial<Feedback> = {}): Feedback {
  return { client, value, revoked: false, ...extra }
}

describe('beta helpers', () => {
  it('round-trips through the quantile', () => {
    for (const p of [0.1, 0.5, 0.9]) {
      expect(betaCdf(betaQuantile(p, 4, 6), 4, 6)).toBeCloseTo(p, 4)
    }
  })
})

describe('rating units', () => {
  it('collapses one reviewer’s repeats in a window to a median', () => {
    const fb = [
      row(addr(1), 100, { tag1: 'starred', createdAt: NOW }),
      row(addr(1), 100, { tag1: 'starred', createdAt: NOW - DAY }),
      row(addr(1), 0, { tag1: 'starred', createdAt: NOW - 2 * DAY }),
    ]
    const layer = buildRatingLayer(fb, { now: NOW })
    expect(layer.units).toHaveLength(1)
    expect(layer.units[0].r).toBeCloseTo(1)
    expect(layer.wallets[0].weight).toBeCloseTo(1)
  })

  it('gives one reviewer 1,000 spaced ratings one full vote at most', () => {
    const fb = Array.from({ length: 1000 }, (_, i) => row(addr(1), 100, { tag1: 'starred', createdAt: NOW - i * DAY }))
    const layer = buildRatingLayer(fb, { now: NOW })
    expect(layer.wallets).toHaveLength(1)
    expect(layer.wallets[0].weight).toBeLessThanOrEqual(1)
    const score = robustScore(layer.wallets)
    expect(score.totalWeight).toBeCloseTo(1)
    expect(score.top1).toBe(1)
    expect(score.value).toBeCloseTo(0.625, 4)
    expect(score.confidence).toBe('low')
  })
})

describe('robust score', () => {
  it('does not punish independent agreement', () => {
    const fb = [
      ...Array.from({ length: 50 }, (_, i) => row(addr(i + 1), 100, { tag1: 'starred', createdAt: NOW })),
      row(addr(99), 20, { tag1: 'starred', createdAt: NOW }),
    ]
    const report = buildReputationReport(fb, { now: NOW })
    expect(report.score).toBeCloseTo(95.7, 1)
    expect(report.confidence).toBe('high')
    expect(report.inflation).toBeCloseTo(2.7, 1)
  })

  it('ignores every non-rating kind', () => {
    const fb = [
      row(addr(1), 90, { tag1: 'starred', createdAt: NOW }),
      row(addr(2), 99, { tag1: 'uptime', createdAt: NOW }),
      row(addr(3), 53, { tag1: 'responseTime', createdAt: NOW }),
      row(addr(4), 12_000, { tag1: 'revenue', createdAt: NOW }),
      row(addr(5), -100, { tag1: 'dispute', createdAt: NOW }),
      row(addr(6), 1, { tag1: 'paid', createdAt: NOW }),
    ]
    const report = buildReputationReport(fb, { now: NOW })
    expect(report.funnel.ratedRows).toBe(1)
    expect(report.score).toBeCloseTo(60, 0)
    expect(report.telemetry.map((t) => t.tag)).toEqual(['uptime', 'responsetime'])
  })

  it('is unrated when only telemetry exists', () => {
    const fb = Array.from({ length: 20 }, (_, i) => row(addr(1), 99, { tag1: 'uptime', createdAt: NOW - i }))
    const report = buildReputationReport(fb, { now: NOW })
    expect(report.unrated).toBe(true)
    expect(report.score).toBeNull()
    expect(report.telemetry).toHaveLength(1)
    expect(report.telemetry[0]).toMatchObject({ tag: 'uptime', rows: 20, clients: 1 })
  })

  it('leaves owner rows out of the score', () => {
    const owner = addr(50)
    const fb = [row(owner, 100, { tag1: 'starred', createdAt: NOW }), row(addr(1), 60, { tag1: 'starred', createdAt: NOW })]
    const report = buildReputationReport(fb, { now: NOW, self: [owner] })
    expect(report.funnel.wallets).toBe(1)
    expect(report.counts.self).toBe(1)
    expect(report.score).toBeCloseTo(52.5, 1)
  })

  it('prices a forced score in fresh wallets', () => {
    const high = buildRatingLayer(Array.from({ length: 20 }, (_, i) => row(addr(i + 1), 100, { tag1: 'starred', createdAt: NOW })), { now: NOW })
    const score = robustScore(high.wallets)
    // Already above 0.9, so nothing to buy.
    expect(score.cost).toBeNull()
    const low = buildRatingLayer(Array.from({ length: 10 }, (_, i) => row(addr(i + 1), 20, { tag1: 'starred', createdAt: NOW })), { now: NOW })
    expect(robustScore(low.wallets).cost).toBeGreaterThan(0)
  })

  it('flags one wallet writing most rating rows', () => {
    const fb = Array.from({ length: 10 }, (_, i) => row(addr(1), 80 + (i % 5), { tag1: 'starred', createdAt: NOW - i * 40 * DAY }))
    const report = buildReputationReport(fb, { now: NOW })
    expect(report.findings.map((f) => f.code)).toContain('repeat')
    expect(report.funnel.wallets).toBe(1)
  })

  it('measures whether low ratings are answered', () => {
    const fb = [
      row(addr(1), 10, { tag1: 'starred', createdAt: NOW - 10 * DAY, responses: [{ responder: addr(90), createdAt: NOW - 8 * DAY }] }),
      row(addr(2), 10, { tag1: 'starred', createdAt: NOW - 9 * DAY }),
      row(addr(3), 90, { tag1: 'starred', createdAt: NOW - 8 * DAY }),
    ]
    const report = buildReputationReport(fb, { now: NOW, self: [addr(90)] })
    expect(report.responsiveness).toMatchObject({ lowRatings: 2, responded: 1, ownerReplies: 1, thirdPartyReplies: 0 })
    expect(report.responsiveness.medianLagDays).toBeCloseTo(2)
  })

  it('counts out-of-scale ratings but never clamps them', () => {
    const fb = [
      ...Array.from({ length: 8 }, (_, i) => row(addr(i + 1), 90, { tag1: 'starred', createdAt: NOW })),
      row(addr(80), 4_000, { tag1: 'starred', createdAt: NOW }),
    ]
    const report = buildReputationReport(fb, { now: NOW })
    expect(report.counts.outOfScale).toBe(1)
    expect(report.funnel.ratedRows).toBe(8)
  })
})
