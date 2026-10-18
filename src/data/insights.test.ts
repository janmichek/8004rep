import { describe, expect, it } from 'vitest'
import type { Address, Hex } from 'viem'
import { dailyColumns, valueHistogram } from './chartData'
import { attachResponses, groupResponses, mergeFeedback } from './feedbackLogs'
import { clusterByFunder, firstFunding } from './funding'
import { computeNetworkStats, jaccard } from './networkStats'
import { buildReviewerProfile, peakWithin, suspicionOf } from './reviewerProfile'
import { computeScores } from './scores'
import type { Feedback, FeedbackEvent } from './types'

const DAY = 86400
const HASH = `0x${'ab'.repeat(32)}` as Hex

function addr(n: number): Address {
  return `0x${n.toString(16).padStart(40, '0')}` as Address
}

function ev(client: Address, tokenId: number, value: number, extra: Partial<FeedbackEvent> = {}): FeedbackEvent {
  return { client, tokenId: BigInt(tokenId), value, revoked: false, ...extra }
}

describe('computeScores lcb', () => {
  it('is null under two full votes and never below the lowest value', () => {
    const one = [{ client: addr(1), value: 80, revoked: false }]
    expect(computeScores(one).lcb).toBeNull()
    const spread = [0, 100].map((value, i) => ({ client: addr(i + 1), value, revoked: false, tag1: `t${i}` }))
    // 50 − 1.96·50/√2 ≈ −19 → floored at the lowest value.
    expect(computeScores(spread).lcb).toBe(0)
  })
})

describe('responses', () => {
  const log = (client: Address, index: bigint, block: bigint, responder: Address, uri = '') => ({
    args: { clientAddress: client, feedbackIndex: index, responder, responseURI: uri },
    blockNumber: block,
    logIndex: 0,
    transactionHash: HASH,
  })

  it('groups ResponseAppended logs by row, oldest first, and attaches them', () => {
    const map = groupResponses([log(addr(1), 2n, 20n, addr(9), 'ipfs://b'), log(addr(1), 2n, 10n, addr(8), 'ipfs://a')])
    const rows: Feedback[] = [
      { client: addr(1), index: 2, value: 90, revoked: false },
      { client: addr(1), index: 3, value: 90, revoked: false },
    ]
    const out = attachResponses(rows, map)
    expect(out[0].responses!.map((r) => r.uri)).toEqual(['ipfs://a', 'ipfs://b'])
    expect(out[1].responses).toBeUndefined()
  })

  it('carries an indexed row’s responses through mergeFeedback', () => {
    const bare: Feedback[] = [{ client: addr(1), index: 1, value: 50, revoked: false }]
    const indexed: Feedback[] = [{ ...bare[0], responses: [{ responder: addr(2) }] }]
    expect(mergeFeedback(bare, indexed)[0].responses).toEqual([{ responder: addr(2) }])
  })
})

describe('buildReviewerProfile', () => {
  it('labels a reviewer that gives one value to many rows a rubber stamp', () => {
    const rows = [1, 2, 3, 4, 5].map((t) => ev(addr(1), t, 100))
    const p = buildReviewerProfile(addr(1), rows)
    expect(p.mode).toEqual({ value: 100, share: 1 })
    expect(p.agents).toBe(5)
    expect(p.labels).toContain('rubber-stamp')
    expect(p.labels).not.toContain('single-agent')
  })

  it('labels single-agent, bulk and harsh reviewers', () => {
    const rows = Array.from({ length: 10 }, (_, i) => ev(addr(1), 7, i * 3, { createdAt: 1000 + i * 60 }))
    const p = buildReviewerProfile(addr(1), rows)
    expect(p.labels).toEqual(expect.arrayContaining(['single-agent', 'bulk', 'harsh']))
    expect(p.peakPerDay).toBe(10)
    expect(p.perAgent).toHaveLength(1)
    expect(suspicionOf(p.labels)).toBe(5)
  })

  it('stays unlabelled with few varied rows', () => {
    const p = buildReviewerProfile(addr(1), [ev(addr(1), 1, 80), ev(addr(1), 2, 60)])
    expect(p.labels).toEqual([])
    expect(p.average).toBe(70)
  })

  it('counts the busiest 24h window', () => {
    expect(peakWithin([0, 10, DAY, DAY + 11, 3 * DAY], DAY)).toBe(3)
    expect(peakWithin([], DAY)).toBe(0)
  })
})

describe('firstFunding', () => {
  const me = addr(5)
  it('takes the earliest incoming transfer with value, external or internal', () => {
    const txlist = {
      result: [
        { from: me, to: addr(9), value: '5', hash: '0x1', blockNumber: '10', timeStamp: '100' },
        { from: addr(7), to: me, value: '0', hash: '0x2', blockNumber: '11', timeStamp: '110' },
        { from: addr(6), to: me, value: '9', hash: '0x3', blockNumber: '30', timeStamp: '300' },
      ],
    }
    const internal = { result: [{ from: addr(4), to: me.toUpperCase(), value: '7', transactionHash: '0x4', blockNumber: '20', timeStamp: '200' }] }
    expect(firstFunding(me, txlist, internal)).toEqual({ funder: addr(4), txHash: '0x4', value: 7n, internal: true, timestamp: 200 })
  })

  it('ignores failed and malformed transfers', () => {
    const txlist = { result: [{ from: addr(6), to: me, value: '9', hash: '0x3', isError: '1' }, { from: 'x', to: me, value: '1', hash: '0x5' }, 'junk'] }
    expect(firstFunding(me, txlist, { result: 'Max rate limit reached' })).toBeNull()
    expect(firstFunding(me, null, undefined)).toBeNull()
  })
})

describe('clusterByFunder', () => {
  const funding = (funder: Address) => ({ funder, txHash: HASH, value: 1n, internal: false })
  it('keeps shared funders and any reviewer funded by the agent itself', () => {
    const clusters = clusterByFunder(
      [
        { reviewer: addr(1), funding: funding(addr(9)) },
        { reviewer: addr(2), funding: funding(addr(9)) },
        { reviewer: addr(3), funding: funding(addr(8)) },
        { reviewer: addr(4), funding: funding(addr(7)) },
        { reviewer: addr(5), funding: null },
      ],
      [addr(7)],
    )
    expect(clusters.map((c) => [c.funder, c.reviewers.length, c.self])).toEqual([
      [addr(7), 1, true],
      [addr(9), 2, false],
    ])
  })
})

describe('computeNetworkStats', () => {
  it('summarizes the window and finds agents sharing one reviewer set', () => {
    const ring = [addr(1), addr(2), addr(3)]
    const rows = [
      ...ring.flatMap((c) => [ev(c, 10, 100, { agentName: 'Ten' }), ev(c, 11, 100), ev(c, 12, 100)]),
      ev(addr(4), 10, 40),
      ev(addr(5), 13, 70, { revoked: true }),
      ev(addr(6), 13, 60),
    ]
    const s = computeNetworkStats(rows)
    expect(s).toMatchObject({ rows: 12, agents: 4, reviewers: 6, revoked: 1 })
    expect(s.perfectShare).toBeCloseTo(9 / 11, 9)
    expect(s.topAgents[0]).toMatchObject({ tokenId: 10n, agentName: 'Ten', rows: 4, reviewers: 4 })
    expect(s.lookalikes).toHaveLength(1)
    // Agent 10 has one more reviewer: 3/4 = 0.75 overlap, under the line.
    expect(s.lookalikes[0].agents.map((a) => a.tokenId)).toEqual([11n, 12n])
    expect(s.lookalikes[0].reviewers).toHaveLength(3)
    expect(s.lookalikes[0].similarity).toBe(1)
  })

  it('ranks labelled reviewers only', () => {
    const rows = [...[1, 2, 3, 4, 5].map((t) => ev(addr(1), t, 100)), ev(addr(2), 1, 50)]
    expect(computeNetworkStats(rows).suspects.map((s) => s.client)).toEqual([addr(1)])
  })

  it('measures overlap with jaccard', () => {
    expect(jaccard(new Set(['a', 'b']), new Set(['b', 'c']))).toBeCloseTo(1 / 3, 9)
    expect(jaccard(new Set(), new Set())).toBe(0)
  })
})

describe('chart data', () => {
  it('bins values into tenths, with overflow bins only when needed', () => {
    const cols = valueHistogram([0, 9.9, 10, 100, 100])
    expect(cols).toHaveLength(10)
    expect(cols[0].segments[0].value).toBe(2)
    expect(cols[9]).toMatchObject({ label: '90–100', segments: [{ key: 'count', value: 2 }] })
    expect(valueHistogram([-5, 150]).map((c) => c.label)).toEqual(['< 0', ...cols.map((c) => c.label), '> 100'])
  })

  it('lays out one column per day, gaps included, and weeks for long spans', () => {
    const items = [{ t: 0, k: 'a' }, { t: 2 * DAY + 5, k: 'b' }, { t: 2 * DAY + 9, k: 'a' }]
    const cols = dailyColumns(items, (i) => i.t, (i) => i.k, ['a', 'b'], { a: 'A', b: 'B' })
    expect(cols.map((c) => c.segments)).toEqual([[{ key: 'a', value: 1 }], [], [{ key: 'a', value: 1 }, { key: 'b', value: 1 }]])
    expect(cols[2].title).toBe('1970-01-03 · 2 rows · 1 A, 1 B')
    const long = dailyColumns([{ t: 0 }, { t: 200 * DAY }], (i) => i.t, () => 'a', ['a'], {})
    expect(long).toHaveLength(29)
    expect(long[0].title).toMatch(/^Week of/)
  })
})

describe('loadFeedWindow', () => {
  it('pages until enough rows, then extends from the cursor', async () => {
    const { loadFeedWindow } = await import('./feed')
    const calls: (string | undefined)[] = []
    const source = {
      async listFeedback({ cursor }: { cursor?: string }) {
        calls.push(cursor)
        const n = Number(cursor ?? 0)
        return { items: [ev(addr(1), n, 50), ev(addr(2), n, 60)], ...(n < 4 ? { cursor: String(n + 1) } : {}) }
      },
    } as unknown as import('./types').DataSource
    const first = await loadFeedWindow(source, {}, { minRows: 3 })
    expect(first.items).toHaveLength(4)
    expect(first.cursor).toBe('2')
    const more = await loadFeedWindow(source, {}, { minRows: 100, from: first })
    expect(more.items).toHaveLength(10)
    expect(more.cursor).toBeUndefined()
    expect(calls).toEqual([undefined, '1', '2', '3', '4'])
    expect(await loadFeedWindow(source, {}, { from: more })).toBe(more)
  })
})
