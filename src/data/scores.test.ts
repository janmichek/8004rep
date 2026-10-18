import { describe, expect, it } from 'vitest'
import type { Address } from 'viem'
import { computeScores, computeWeights } from './scores'
import type { Feedback } from './types'

const A = '0x00000000000000000000000000000000000000a1' as Address
const B = '0x00000000000000000000000000000000000000b2' as Address
const C = '0x00000000000000000000000000000000000000c3' as Address

function row(client: Address, value: number, extra: Partial<Feedback> = {}): Feedback {
  return { client, value, revoked: false, ...extra }
}

describe('computeWeights', () => {
  it('zero-weights exact duplicates after the first', () => {
    const fb = [row(A, 90, { tag1: 'starred' }), row(B, 90, { tag1: 'starred' })]
    const { weights, flaggedDuplicates } = computeWeights(fb)
    expect(weights[0]).toBe(1)
    expect(weights[1]).toBe(0)
    expect(flaggedDuplicates).toBe(1)
  })

  it('down-weights bursts from the same client within 24h', () => {
    const fb = [0, 1, 2, 3, 4].map((h) => row(A, 80 + h, { createdAt: 1_000_000 + h * 3600 }))
    const { weights } = computeWeights(fb)
    // N=5 in window → exp(-3) ≈ 0.05
    expect(weights[0]).toBeCloseTo(Math.exp(-3), 5)
  })

  it('penalizes monotonous reviewers', () => {
    const fb = [row(A, 100), row(A, 100), row(A, 100)]
    const { weights, flaggedMonotonous } = computeWeights(fb)
    expect(weights[0]).toBe(0.4)
    expect(flaggedMonotonous).toBe(3)
  })

  it('revoked rows weigh nothing', () => {
    const fb = [{ ...row(A, 100), revoked: true }]
    expect(computeWeights(fb).weights[0]).toBe(0)
  })
})

describe('computeScores', () => {
  it('empty feedback yields nulls', () => {
    const s = computeScores([])
    expect(s.n).toBe(0)
    expect(s.raw).toBeNull()
    expect(s.weighted).toBeNull()
    expect(s.bayes).toBeNull()
  })

  it('single honest review: raw == weighted, bayes shrinks to prior', () => {
    const s = computeScores([row(A, 80)])
    expect(s.raw).toBe(80)
    expect(s.weighted).toBe(80)
    // (1*80 + 5*0)/6
    expect(s.bayes).toBeCloseTo(80 / 6, 5)
    expect(s.effectiveCount).toBe(1)
  })

  it('gap exposes a farmed duplicate', () => {
    const s = computeScores([row(A, 100), row(B, 100), row(C, 0)])
    // raw = 200/3 ≈ 66.7, weighted drops a duplicate 100
    expect(s.raw).toBeCloseTo(66.67, 1)
    expect(s.weighted).toBeCloseTo(50, 5)
    expect(s.gap).toBeCloseTo(16.67, 1)
  })

  it('consensus is 1 for identical scores, polarization 0', () => {
    const s = computeScores([row(A, 50), row(B, 50), row(C, 50)])
    // duplicates zero-weighted → single effective voice still unanimous
    expect(s.consensus).toBe(1)
    expect(s.polarization).toBe(0)
  })

  it('time decay favors recent feedback', () => {
    const now = 10_000_000
    const fb = [row(A, 0, { createdAt: now - 200 * 86400 }), row(B, 100, { createdAt: now })]
    const s = computeScores(fb, { now })
    expect(s.timeWeighted).not.toBeNull()
    expect(s.timeWeighted as number).toBeGreaterThan(80)
  })

  it('per-tag breakdown groups by tag1', () => {
    const fb = [row(A, 90, { tag1: 'starred' }), row(B, 10, { tag1: 'spam' })]
    const s = computeScores(fb)
    expect(s.perTag).toHaveLength(2)
    expect(s.perTag.find((t) => t.tag === 'starred')?.average).toBe(90)
  })
})
