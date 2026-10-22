import { describe, expect, it } from 'vitest'
import type { Address } from 'viem'
import { computeFeedbackStats } from './feedbackStats'
import type { Feedback } from './types'

const A = '0x00000000000000000000000000000000000000a1' as Address
const B = '0x00000000000000000000000000000000000000b2' as Address
const C = '0x00000000000000000000000000000000000000c3' as Address
const OWNER = '0x00000000000000000000000000000000000000F0' as Address

const NOW = 100_000_000
const DAY = 86400

function row(client: Address, value: number, extra: Partial<Feedback> = {}): Feedback {
  return { client, value, revoked: false, ...extra }
}

function codes(feedback: Feedback[], context: Parameters<typeof computeFeedbackStats>[1] = {}): string[] {
  return computeFeedbackStats(feedback, { now: NOW, ...context }).signals.map((s) => s.code)
}

describe('computeFeedbackStats reviews', () => {
  it('is clean and empty without feedback', () => {
    const stats = computeFeedbackStats([])
    expect(stats.rows).toEqual([])
    expect(stats.reviewers).toEqual([])
    expect(stats.level).toBe('clean')
  })

  it('flags and zero-weights reviews from the owner or agent wallet, case-insensitively', () => {
    const feedback = [row(OWNER.toLowerCase() as Address, 100), row(A, 60)]
    const stats = computeFeedbackStats(feedback, { owner: OWNER, now: NOW })
    expect(stats.rows[0]).toMatchObject({ weight: 0, flags: ['self'] })
    expect(stats.rows[1]).toMatchObject({ weight: 1, flags: [] })
    expect(stats.signals[0]).toMatchObject({ level: 'high', code: 'self' })
    expect(stats.level).toBe('high')
  })

  it('names the reason behind each discounted weight', () => {
    const feedback = [row(A, 90), row(B, 90), row(C, 80, { revoked: true })]
    const { rows } = computeFeedbackStats(feedback, { now: NOW })
    expect(rows[1].flags).toEqual(['duplicate'])
    expect(rows[2].flags).toEqual(['revoked'])
  })

  it('marks a value far from the rest as an outlier with its robust z', () => {
    const feedback = [80, 82, 84, 86, 88, 90, -400].map((v, i) => row(A, v, { tag1: `t${i}` }))
    const { rows } = computeFeedbackStats(feedback, { now: NOW })
    expect(rows[6].flags).toContain('outlier')
    expect(rows[6].flags).toContain('out-of-range')
    expect(rows[6].deviation as number).toBeLessThan(-3.5)
    expect(rows[2].flags).not.toContain('outlier')
  })

  it('does not judge spread on fewer than five reviews', () => {
    const { rows } = computeFeedbackStats([row(A, 1), row(B, 2), row(C, 1000)], { now: NOW })
    expect(rows.every((r) => r.deviation === null)).toBe(true)
  })

  it('checks endpoints against the registration file only when it is known', () => {
    const feedback = [
      row(A, 90, { endpoint: 'https://api.example.com/mcp/' }),
      row(B, 80, { endpoint: 'https://API.example.com/mcp/tools' }),
      row(C, 70, { endpoint: 'https://evil.example/mcp' }),
    ]
    const known = computeFeedbackStats(feedback, { services: ['https://api.example.com/mcp'], now: NOW })
    expect(known.rows.map((r) => r.flags.includes('unlisted-endpoint'))).toEqual([false, false, true])
    const unknown = computeFeedbackStats(feedback, { now: NOW })
    expect(unknown.rows.some((r) => r.flags.includes('unlisted-endpoint'))).toBe(false)
  })

  it('counts how many reviews each client left', () => {
    const { rows } = computeFeedbackStats([row(A, 1), row(B, 2), row(A, 3)], { now: NOW })
    expect(rows.map((r) => r.clientRows)).toEqual([2, 1, 2])
  })
})

describe('computeFeedbackStats reviewers', () => {
  it('breaks feedback down per client, most reviews first', () => {
    const feedback = [
      row(A, 100, { createdAt: NOW - 50 * DAY }),
      row(B, 0, { createdAt: NOW - 40 * DAY }),
      row(A, 80, { createdAt: NOW - 10 * DAY }),
      row(A, 60, { revoked: true }),
    ]
    const [first, second] = computeFeedbackStats(feedback, { now: NOW }).reviewers
    expect(first).toMatchObject({
      client: A,
      rows: 3,
      revoked: 1,
      average: 90,
      min: 80,
      max: 100,
      first: NOW - 50 * DAY,
      last: NOW - 10 * DAY,
    })
    expect(first.share).toBeCloseTo(2 / 3, 5)
    // raw average 60; without A only B's 0 remains.
    expect(first.shiftWithout).toBeCloseTo(-60, 5)
    expect(second.client).toBe(B)
    expect(second.shiftWithout).toBeCloseTo(30, 5)
  })

  it('has no leave-one-out shift for a sole reviewer', () => {
    const [only] = computeFeedbackStats([row(A, 50), row(A, 70)], { now: NOW }).reviewers
    expect(only.shiftWithout).toBeNull()
    expect(only.share).toBe(1)
  })
})

describe('computeFeedbackStats signals', () => {
  it('reports one client holding most of the counted reviews', () => {
    const feedback = [row(A, 90), row(A, 91), row(A, 92), row(A, 93), row(B, 50)]
    const stats = computeFeedbackStats(feedback, { now: NOW })
    const signal = stats.signals.find((s) => s.code === 'concentration')
    expect(signal).toMatchObject({ level: 'high' })
    expect(signal?.text).toContain('4 of 5')
  })

  it('reports an average that hinges on a single reviewer', () => {
    const feedback = [row(A, 100), row(A, 95), row(B, 0), row(C, 5)]
    expect(codes(feedback)).toContain('fragile')
  })

  it('reports a surge only against a quieter month', () => {
    const burst = [A, B, C].map((c, i) => row(c, 80 + i, { createdAt: NOW - DAY * (i + 1) }))
    expect(codes(burst)).toContain('surge')
    const steady = [
      ...burst,
      ...[10, 14, 18, 22, 26, 30].map((d, i) => row(C, 60 + i, { createdAt: NOW - d * DAY })),
    ]
    expect(codes(steady)).not.toContain('surge')
  })

  it('reports a falling recent average', () => {
    const feedback = [
      row(A, 90, { createdAt: NOW - 100 * DAY }),
      row(B, 95, { createdAt: NOW - 90 * DAY }),
      row(C, 20, { createdAt: NOW - 20 * DAY }),
      row(A, 10, { createdAt: NOW - 12 * DAY }),
    ]
    const stats = computeFeedbackStats(feedback, { now: NOW })
    expect(stats.signals.find((s) => s.code === 'decline')?.text).toBe(
      'Last 30 days average 15 (n=2) vs 92.50 before (n=2)',
    )
  })

  it('reports a high revocation rate and undated reviews', () => {
    const feedback = [row(A, 90, { revoked: true }), row(B, 80, { revoked: true }), row(C, 70)]
    expect(codes(feedback)).toEqual(expect.arrayContaining(['revocations', 'undated']))
  })

  it('stays clean for a few independent, dated, agreeing reviews', () => {
    const feedback = [
      row(A, 90, { createdAt: NOW - 60 * DAY }),
      row(B, 85, { createdAt: NOW - 40 * DAY }),
      row(C, 88, { createdAt: NOW - 20 * DAY }),
    ]
    const stats = computeFeedbackStats(feedback, { now: NOW })
    expect(stats.signals).toEqual([])
    expect(stats.level).toBe('clean')
  })

  it('orders signals worst first and counts evidence', () => {
    const feedback = [
      row(OWNER, 500, { txHash: '0x01', feedbackURI: 'ipfs://x', createdAt: NOW - DAY }),
      row(A, 60, { endpoint: 'https://a.example' }),
    ]
    const stats = computeFeedbackStats(feedback, { agentWallet: OWNER, now: NOW })
    expect(stats.signals.map((s) => s.level)).toEqual(['high', 'warn', 'info', 'info'])
    expect(stats.signals[0].code).toBe('self')
    expect(stats.coverage).toEqual({ total: 2, dated: 1, withTx: 1, withUri: 1, withEndpoint: 1 })
  })
})
