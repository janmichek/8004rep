import { describe, expect, it } from 'vitest'
import type { Address } from 'viem'
import {
  BULK_PER_DAY,
  HARSH_AVERAGE,
  MASS_AGENTS,
  MIN_PATTERN_ROWS,
  buildReviewerProfile,
  peakWithin,
  suspicionOf,
} from './reviewerProfile'
import type { FeedbackEvent } from './types'

const A: Address = '0x00000000000000000000000000000000000000a1'
const DAY = 86_400

function row(value: number, over: Partial<FeedbackEvent> = {}): FeedbackEvent {
  return { client: A, value, revoked: false, tokenId: 1n, ...over }
}

/** `count` rows of `value`, each on its own agent, so no per-agent rule fires. */
function spread(count: number, value = 80, from = 0): FeedbackEvent[] {
  return Array.from({ length: count }, (_, i) => row(value, { tokenId: BigInt(from + i + 1) }))
}

describe('peakWithin', () => {
  it('counts nothing in an empty series', () => {
    expect(peakWithin([], DAY)).toBe(0)
  })

  it('keeps two rows exactly the span apart in the same window', () => {
    expect(peakWithin([0, DAY], DAY)).toBe(2)
    expect(peakWithin([0, DAY + 1], DAY)).toBe(1)
  })

  it('finds the busiest window, not the first or the last', () => {
    expect(peakWithin([0, 10 * DAY, 10 * DAY + 5, 10 * DAY + 9], DAY)).toBe(3)
  })

  it('does not care what order the times arrive in', () => {
    expect(peakWithin([10 * DAY + 9, 0, 10 * DAY], DAY)).toBe(2)
  })
})

describe('buildReviewerProfile', () => {
  it('describes a reviewer with nothing to say about them', () => {
    const profile = buildReviewerProfile(A, [])
    expect(profile).toMatchObject({ rows: 0, revoked: 0, agents: 0, average: null, mode: null, peakPerDay: 0 })
    expect(profile.labels).toEqual([])
    expect(profile.chainIds).toEqual([])
    expect('first' in profile).toBe(false)
  })

  it('averages and takes the mode over live rows only, while `rows` counts every row', () => {
    const profile = buildReviewerProfile(A, [row(100), row(100), row(0, { revoked: true })])
    expect(profile).toMatchObject({ rows: 3, revoked: 1, average: 100 })
    expect(profile.mode).toEqual({ value: 100, share: 1 })
  })

  it('reports the window the rows span, from the rows that carry a date', () => {
    const profile = buildReviewerProfile(A, [row(80, { createdAt: 300 }), row(80), row(80, { createdAt: 100 })])
    expect(profile).toMatchObject({ first: 100, last: 300 })
  })

  it('groups per agent by chain and token, since token ids repeat between networks', () => {
    const profile = buildReviewerProfile(A, [
      row(80, { tokenId: 1n, chainId: 1 }),
      row(60, { tokenId: 1n, chainId: 8453 }),
      row(40, { tokenId: 1n, chainId: 8453 }),
    ])
    expect(profile.agents).toBe(2)
    expect(profile.perAgent[0]).toMatchObject({ chainId: 8453, rows: 2, average: 50 })
    expect(profile.chainIds).toEqual([8453, 1])
  })

  it('groups rows that carry no chain by token alone, and leaves the chain off', () => {
    const profile = buildReviewerProfile(A, [row(80, { tokenId: 7n }), row(60, { tokenId: 7n })])
    expect(profile.agents).toBe(1)
    expect('chainId' in profile.perAgent[0]).toBe(false)
    expect(profile.chainIds).toEqual([])
  })

  it('breaks an equal row count between agents by token id, so the order is stable', () => {
    const profile = buildReviewerProfile(A, [row(80, { tokenId: 9n }), row(80, { tokenId: 2n })])
    expect(profile.perAgent.map((p) => p.tokenId)).toEqual([2n, 9n])
  })

  it('reports an agent whose every row was revoked as having no average', () => {
    const profile = buildReviewerProfile(A, [row(80, { revoked: true })])
    expect(profile.perAgent[0]).toMatchObject({ rows: 1, revoked: 1, average: null })
  })

  it('names the agent from whichever row carries a name', () => {
    const profile = buildReviewerProfile(A, [row(80), row(80, { agentName: 'Scribe' })])
    expect(profile.perAgent[0].agentName).toBe('Scribe')
  })

  it('orders chains by how many rows came from each, then by chain id', () => {
    const profile = buildReviewerProfile(A, [
      row(80, { chainId: 8453, tokenId: 1n }),
      row(80, { chainId: 1, tokenId: 2n }),
      row(80, { chainId: 137, tokenId: 3n }),
      row(80, { chainId: 137, tokenId: 4n }),
    ])
    expect(profile.chainIds).toEqual([137, 1, 8453])
  })
})

describe('the flags a profile raises', () => {
  it('calls one value a rubber stamp only at the share and the row count the rule names', () => {
    expect(buildReviewerProfile(A, spread(MIN_PATTERN_ROWS - 1)).labels).not.toContain('rubber-stamp')
    expect(buildReviewerProfile(A, spread(MIN_PATTERN_ROWS)).labels).toContain('rubber-stamp')

    // 9 of 10 on one value is exactly the threshold; 8 of 10 is under it.
    const nine = [...spread(9, 80), ...spread(1, 10, 9)]
    const eight = [...spread(8, 80), ...spread(2, 10, 8)]
    expect(buildReviewerProfile(A, nine).labels).toContain('rubber-stamp')
    expect(buildReviewerProfile(A, eight).labels).not.toContain('rubber-stamp')
  })

  it('ignores revoked rows when deciding a rubber stamp', () => {
    const rows = [...spread(MIN_PATTERN_ROWS - 1), row(80, { tokenId: 99n, revoked: true })]
    expect(buildReviewerProfile(A, rows).labels).not.toContain('rubber-stamp')
  })

  it('flags one agent only from three rows, counting revoked ones toward the three', () => {
    expect(buildReviewerProfile(A, [row(80), row(60)]).labels).not.toContain('single-agent')
    expect(buildReviewerProfile(A, [row(80), row(60), row(40, { revoked: true })]).labels).toContain('single-agent')
    // Two agents is not one agent, however many rows there are.
    expect(buildReviewerProfile(A, spread(4)).labels).not.toContain('single-agent')
  })

  it('flags a bulk writer at the row count the rule names, inside one day', () => {
    const inside = spread(BULK_PER_DAY).map((r, i) => ({ ...r, createdAt: i * 60 }))
    const spaced = spread(BULK_PER_DAY).map((r, i) => ({ ...r, createdAt: i * (DAY + 1) }))
    expect(buildReviewerProfile(A, inside).labels).toContain('bulk')
    expect(buildReviewerProfile(A, spaced).labels).not.toContain('bulk')
    expect(buildReviewerProfile(A, inside.slice(0, BULK_PER_DAY - 1)).labels).not.toContain('bulk')
  })

  it('counts a revoked row toward bulk: it was still written that day', () => {
    const rows = spread(BULK_PER_DAY).map((r, i) => ({ ...r, createdAt: i * 60, revoked: true }))
    expect(buildReviewerProfile(A, rows).labels).toContain('bulk')
  })

  it('flags a mass reviewer at the agent count the rule names', () => {
    expect(buildReviewerProfile(A, spread(MASS_AGENTS - 1)).labels).not.toContain('mass')
    expect(buildReviewerProfile(A, spread(MASS_AGENTS)).labels).toContain('mass')
  })

  it('flags harsh at the average the rule names, and not above it', () => {
    expect(buildReviewerProfile(A, spread(MIN_PATTERN_ROWS, HARSH_AVERAGE)).labels).toContain('harsh')
    expect(buildReviewerProfile(A, spread(MIN_PATTERN_ROWS, HARSH_AVERAGE + 1)).labels).not.toContain('harsh')
    expect(buildReviewerProfile(A, spread(MIN_PATTERN_ROWS - 1, 0)).labels).not.toContain('harsh')
  })
})

describe('suspicionOf', () => {
  it('counts nothing for a clean reviewer', () => {
    expect(suspicionOf([])).toBe(0)
  })

  it('weighs a warning twice an informational note', () => {
    expect(suspicionOf(['mass'])).toBe(1)
    expect(suspicionOf(['rubber-stamp'])).toBe(2)
    expect(suspicionOf(['rubber-stamp', 'mass', 'bulk'])).toBe(5)
  })
})
