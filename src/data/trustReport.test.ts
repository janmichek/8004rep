import { describe, expect, it } from 'vitest'
import type { Address } from 'viem'
import { computeFeedbackStats } from './feedbackStats'
import { computeScores } from './scores'
import { buildTrustReport, scoreWaterfall } from './trustReport'
import type { Feedback } from './types'

const OWNER = '0x00000000000000000000000000000000000000f0' as Address

function addr(n: number): Address {
  return `0x${n.toString(16).padStart(40, '0')}` as Address
}

function row(client: Address, value: number, extra: Partial<Feedback> = {}): Feedback {
  return { client, value, revoked: false, ...extra }
}

function report(feedback: Feedback[], owner?: Address) {
  return buildTrustReport(feedback, computeFeedbackStats(feedback, { owner, now: 100_000_000 }), owner ? [owner] : [])
}

describe('scoreWaterfall', () => {
  it('walks from the plain mean to the weighted score one rule at a time', () => {
    const feedback = [
      row(addr(1), 40, { tag1: 'a' }),
      row(addr(2), 80, { tag1: 'b' }),
      row(addr(3), 0, { revoked: true }),
      row(OWNER, 100, { tag1: 'c' }),
      row(addr(4), 80, { tag1: 'b' }),
    ]
    const steps = scoreWaterfall(feedback, [OWNER])
    expect(steps.map((s) => s.id)).toEqual(['all', 'revoked', 'self', 'duplicate', 'burst', 'pattern'])
    expect(steps[0]).toMatchObject({ average: 60, rows: 5 })
    expect(steps[1]).toMatchObject({ average: 75, rows: 1, delta: 15 })
    expect(steps[2].average).toBeCloseTo(200 / 3, 6)
    expect(steps[3]).toMatchObject({ average: 60, rows: 1 })
    expect(steps[4]).toMatchObject({ rows: 0, delta: 0 })
    // The last step lands on the weighted score of computeScores.
    expect(steps.at(-1)!.average).toBeCloseTo(computeScores(feedback, { self: [OWNER] }).weighted!, 9)
  })

  it('applies partial discounts as weights, not removals', () => {
    const feedback = [row(addr(1), 100), row(addr(1), 100), row(addr(1), 100, { tag1: 'x' }), row(addr(2), 0)]
    const steps = scoreWaterfall(feedback)
    const pattern = steps.find((s) => s.id === 'pattern')!
    // addr(1) left three 100s → ×0.4; its duplicate already weighs 0 and is not counted again.
    expect(pattern.rows).toBe(2)
    expect(pattern.average).toBeCloseTo(computeScores(feedback).weighted!, 9)
  })

  it('reports a null average once every row is gone', () => {
    const steps = scoreWaterfall([row(OWNER, 100)], [OWNER])
    expect(steps.find((s) => s.id === 'self')!.average).toBeNull()
    expect(steps.at(-1)!.average).toBeNull()
  })

  it('is a single empty step without feedback', () => {
    expect(scoreWaterfall([])).toEqual([expect.objectContaining({ id: 'all', average: null, rows: 0 })])
  })
})

describe('buildTrustReport', () => {
  it('has no evidence without feedback', () => {
    const r = report([])
    expect(r.strength.tier).toBe('none')
    expect(r.trusted).toBeNull()
    expect(r.headline).toMatch(/no feedback/i)
  })

  it('calls one or two reviewers thin evidence, whatever the score', () => {
    const r = report([row(addr(1), 100), row(addr(2), 100, { tag1: 'x' })])
    expect(r.strength.tier).toBe('thin')
    expect(r.trusted).toBe(100)
    expect(r.strength.reasons.join(' ')).toMatch(/2 reviewers carry weight/)
  })

  it('calls many independent reviewers strong evidence', () => {
    const feedback = Array.from({ length: 15 }, (_, i) => row(addr(i + 1), 70 + i, { tag1: `t${i}` }))
    expect(report(feedback).strength.tier).toBe('strong')
  })

  it('caps the tier at moderate when one reviewer dominates the weight', () => {
    const many = Array.from({ length: 12 }, (_, i) => row(addr(i + 1), 60 + i, { tag1: `t${i}` }))
    const heavy = Array.from({ length: 12 }, (_, i) => row(addr(99), 90 + (i % 10) * 0.5, { tag1: `h${i}` }))
    const r = report([...many, ...heavy])
    expect(r.strength.tier).not.toBe('strong')
    expect(r.strength.reasons.join(' ')).toMatch(/largest reviewer/i)
  })

  it('says how far the trusted score sits from the raw one', () => {
    const r = report([row(OWNER, 100), row(addr(1), 50), row(addr(2), 60, { tag1: 'x' })], OWNER)
    expect(r.raw).toBeCloseTo(70, 6)
    expect(r.trusted).toBe(55)
    expect(r.headline).toMatch(/55/)
    expect(r.headline).toMatch(/70/)
  })

  it('climbs the evidence ladder by what each row carries', () => {
    const r = report([
      row(addr(1), 80),
      row(addr(2), 80, { tag1: 'starred', endpoint: 'https://x' }),
      row(addr(3), 80, { tag1: 'b', feedbackURI: 'ipfs://cid' }),
      row(addr(4), 80, { revoked: true, feedbackURI: 'ipfs://cid2' }),
    ])
    expect(r.ladder.map((l) => [l.id, l.rows])).toEqual([
      ['bare', 1],
      ['context', 1],
      ['file', 1],
    ])
  })
})
