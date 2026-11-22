import { describe, expect, it } from 'vitest'
import type { Address } from 'viem'
import type { Feedback } from '../types'
import { buildReputationReport } from './report'
import { betaCdf, betaQuantile, filteredScore } from './score'
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
    expect(layer.wallets[0].weight).toBeLessThanOrEqual(1)
    expect(layer.wallets[0].weight).toBeCloseTo(2 ** (-1 / 90), 5)
  })

  it('gives one reviewer 1,000 spaced ratings one full vote at most', () => {
    const fb = Array.from({ length: 1000 }, (_, i) => row(addr(1), 100, { tag1: 'starred', createdAt: NOW - i * DAY }))
    const layer = buildRatingLayer(fb, { now: NOW })
    expect(layer.wallets).toHaveLength(1)
    expect(layer.wallets[0].weight).toBeLessThanOrEqual(1)
    const score = filteredScore(layer.wallets)
    expect(score.totalWeight).toBeCloseTo(1)
    expect(score.top1).toBe(1)
    expect(score.value).toBeCloseTo(0.625, 4)
    expect(score.confidence).toBe('low')
  })
})

describe('filtered score', () => {
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
    const score = filteredScore(high.wallets)
    // Already above 0.9, so nothing to buy.
    expect(score.cost).toBeNull()
    const low = buildRatingLayer(Array.from({ length: 10 }, (_, i) => row(addr(i + 1), 20, { tag1: 'starred', createdAt: NOW })), { now: NOW })
    expect(filteredScore(low.wallets).cost).toBeGreaterThan(0)
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

  it('keeps raw values on 0–100 and makes the revoked step real', () => {
    const fb = [
      row(addr(1), 100, { tag1: 'starred', createdAt: NOW }),
      row(addr(2), 80, { tag1: 'starred', createdAt: NOW }),
      row(addr(3), 60, { tag1: 'starred', createdAt: NOW, revoked: true }),
    ]
    const report = buildReputationReport(fb, { now: NOW })
    expect(report.raw).toBeCloseTo(90)
    expect(report.waterfall[0]).toMatchObject({ id: 'all', average: 80, rows: 3 })
    expect(report.waterfall[1]).toMatchObject({ id: 'revoked', average: 90, rows: 2 })
    expect(report.waterfall[1].delta).toBeCloseTo(10)
  })

  it('shows the self-review step instead of dropping it inside the unit step', () => {
    const owner = addr(50)
    const fb = [
      row(owner, 100, { tag1: 'starred', createdAt: NOW }),
      row(addr(1), 60, { tag1: 'starred', createdAt: NOW }),
      row(addr(2), 80, { tag1: 'starred', createdAt: NOW }),
    ]
    const report = buildReputationReport(fb, { now: NOW, self: [owner] })
    const ratings = report.waterfall.find((s) => s.id === 'ratings')!
    const self = report.waterfall.find((s) => s.id === 'self')!
    expect(ratings.average).toBeCloseTo(80)
    expect(self.average).toBeCloseTo(70)
    expect(self.rows).toBe(2)
    expect(report.rawRatings).toBeCloseTo(70)
  })

  it('uses only dated ratings in the burst denominator', () => {
    const fb = [
      ...Array.from({ length: 10 }, (_, i) => row(addr(i + 1), 80, { tag1: 'starred', createdAt: NOW })),
      ...Array.from({ length: 3 }, (_, i) => row(addr(20 + i), 80, { tag1: 'starred', createdAt: NOW - (i + 1) * DAY })),
      ...Array.from({ length: 100 }, (_, i) => row(addr(40 + i), 80, { tag1: 'starred' })),
    ]
    const report = buildReputationReport(fb, { now: NOW })
    expect(report.burst.maxDayRows).toBe(10)
    expect(report.burst.activeDays).toBe(4)
    expect(report.burst.ratio).toBeCloseTo(10 / (13 / 4), 5)
  })

  it('decays a unit from its median timestamp, independent of row order', () => {
    const start = Math.floor(NOW / (30 * DAY)) * (30 * DAY)
    const now = start + 30 * DAY
    const rows = [
      row(addr(1), 100, { tag1: 'starred', createdAt: start + DAY }),
      row(addr(1), 0, { tag1: 'starred', createdAt: start + 29 * DAY }),
    ]
    const a = buildRatingLayer(rows, { now }).units[0]
    const b = buildRatingLayer([...rows].reverse(), { now }).units[0]
    expect(a.time).toBeCloseTo(b.time, 10)
    expect(a.ageDays).toBeCloseTo(15, 5)
    expect(a.time).toBeCloseTo(2 ** (-15 / 90), 5)
  })

  it('decays against the clock, not the newest review on an abandoned agent', () => {
    const old = Math.floor(Date.now() / 1000) - 730 * DAY
    const layer = buildRatingLayer([row(addr(1), 100, { tag1: 'starred', createdAt: old })])
    expect(layer.wallets[0].weight).toBeLessThan(0.1)
  })

  it('reports each wallet share and exact leave-one-out pull', () => {
    const fb = [
      row(addr(1), 100, { tag1: 'starred', createdAt: NOW }),
      row(addr(2), 50, { tag1: 'starred', createdAt: NOW }),
    ]
    const report = buildReputationReport(fb, { now: NOW })
    const [top, low] = report.contributions
    expect(top.client.toLowerCase()).toBe(addr(1))
    expect(top.share).toBeCloseTo(0.5)
    // Prior (3 × 0.5) plus one 100 and one 50: 3/5 = 0.6. Without the top
    // wallet, 2/4 = 0.5 → −10 points; without the low, 2.5/4 = 0.625 → +2.5.
    expect(top.without).toBeCloseTo(-10, 6)
    expect(low.without).toBeCloseTo(2.5, 6)
  })

  it('counts contributing wallets, not rating rows, at the wallet-cap step', () => {
    const fb = [
      row(addr(1), 100, { tag1: 'starred', createdAt: NOW }),
      row(addr(1), 100, { tag1: 'starred', createdAt: NOW - 40 * DAY }),
      row(addr(2), 50, { tag1: 'starred', createdAt: NOW }),
    ]
    const report = buildReputationReport(fb, { now: NOW })
    expect(report.waterfall.find((s) => s.id === 'cap')).toMatchObject({ rows: 2 })
  })

  it('infers tag scales without self-review values', () => {
    const owner = addr(50)
    const fb = [
      row(owner, 10_000, { tag1: 'starred', createdAt: NOW }),
      row(owner, 20_000, { tag1: 'starred', createdAt: NOW }),
      row(addr(1), 4, { tag1: 'starred', createdAt: NOW }),
      row(addr(2), 5, { tag1: 'starred', createdAt: NOW }),
    ]
    const report = buildReputationReport(fb, { now: NOW, self: [owner] })
    // The two non-self values are 4/5 and 5/5; the owner's huge values do not
    // make the tag unbounded or turn the real ratings into 4% and 5%.
    expect(report.rawRatings).toBeCloseTo(90)
    expect(report.funnel.ratedRows).toBe(2)
    expect(report.counts.outOfScale).toBe(0)
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
