import { describe, expect, it } from 'vitest'
import type { Address } from 'viem'
import { loadAgentWindow, ownerDirectory, reviewerDirectory } from './directory'
import type { AgentSummary, DataSource, FeedbackEvent } from './types'

const A: Address = '0x00000000000000000000000000000000000000a1'
const B: Address = '0x00000000000000000000000000000000000000b2'

function agent(tokenId: number, owner: Address | null, chainId = 1): AgentSummary {
  return { chainId, tokenId: BigInt(tokenId), owner, agentURI: null }
}

function row(client: Address, value: number, tokenId = 1n): FeedbackEvent {
  return { client, value, revoked: false, tokenId }
}

describe('ownerDirectory', () => {
  it('counts agents per owner, most first, ignoring unowned agents', () => {
    const list = ownerDirectory([agent(5, A), agent(4, B), agent(3, A), agent(2, null), agent(1, A)])
    expect(list.map((o) => [o.owner, o.agents])).toEqual([
      [A, 3],
      [B, 1],
    ])
  })

  it('keeps the newest token seen for each owner', () => {
    const [entry] = ownerDirectory([agent(9, A), agent(4, A)])
    expect(entry.latest).toEqual({ chainId: 1, tokenId: 9n })
  })

  it('folds one owner across chains and lists its chains, main chain first', () => {
    const list = ownerDirectory([agent(3, A, 8453), agent(7, A, 1), agent(2, A, 1), agent(5, B, 1)])
    expect(list).toHaveLength(2)
    expect(list[0]).toMatchObject({ owner: A, agents: 3, chainIds: [1, 8453], latest: { chainId: 1, tokenId: 7n } })
  })

  it('merges owners that differ only in address case', () => {
    const upper = A.toUpperCase().replace('0X', '0x') as Address
    expect(ownerDirectory([agent(2, A), agent(1, upper)])).toHaveLength(1)
  })
})

describe('reviewerDirectory', () => {
  it('groups rows by reviewer and builds each profile', () => {
    const list = reviewerDirectory([row(A, 80, 1n), row(B, 100, 1n), row(A, 90, 2n)])
    expect(list.map((r) => [r.address, r.rows, r.agents])).toEqual([
      [A, 2, 2],
      [B, 1, 1],
    ])
    expect(list[0].average).toBe(85)
  })

  it('counts an agent per chain, since token IDs repeat across networks', () => {
    const rows = [
      { ...row(A, 80, 1n), chainId: 1 },
      { ...row(A, 90, 1n), chainId: 8453 },
    ]
    const [profile] = reviewerDirectory(rows)
    expect(profile.agents).toBe(2)
    expect(profile.chainIds).toEqual([1, 8453])
  })

  it('returns nothing for an empty window', () => {
    expect(reviewerDirectory([])).toEqual([])
  })
})

describe('loadAgentWindow', () => {
  it('stops once the source runs out', async () => {
    const pages: number[] = []
    const source = {
      listAgents: async ({ page }: { page: number }) => {
        pages.push(page)
        return { items: [agent(page, A)], hasMore: page < 1 }
      },
    } as unknown as DataSource
    const items = await loadAgentWindow(source, { minRows: 10, maxSteps: 5 })
    expect(pages).toEqual([0, 1])
    expect(items).toHaveLength(2)
  })

  it('stops at the row target', async () => {
    let calls = 0
    const source = {
      listAgents: async () => {
        calls++
        return { items: [agent(calls, A)], hasMore: true }
      },
    } as unknown as DataSource
    await loadAgentWindow(source, { minRows: 1, maxSteps: 5 })
    expect(calls).toBe(1)
  })
})
