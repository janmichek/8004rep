import { describe, expect, it } from 'vitest'
import type { PublicClient } from 'viem'
import { resolveSource } from './index'
import type { SubgraphSource } from './subgraph'
import type { AgentDetail, DataSource } from './types'

const rpcClient = {} as PublicClient

const rpc: DataSource = {
  kind: 'rpc',
  supportsTextSearch: false,
  listAgents: async () => ({ items: [], hasMore: false }),
  getAgent: async () => null,
  listFeedback: async () => ({ items: [] }),
}

function subgraph(meta: SubgraphSource['meta']): SubgraphSource {
  return { ...rpc, kind: 'subgraph', supportsTextSearch: true, meta }
}

describe('resolveSource', () => {
  it('uses RPC for chains without a subgraph', async () => {
    expect(await resolveSource(rpc, rpcClient)).toEqual({ source: rpc, rpcClient })
  })

  it('uses a healthy subgraph and reports its lag', async () => {
    const sg = subgraph(async () => ({ block: 100, timestamp: 1000 }))
    expect(await resolveSource(rpc, rpcClient, sg, 4600)).toEqual({ source: sg, rpcClient, lagSeconds: 3600 })
  })

  it('falls back to RPC when the subgraph stopped indexing', async () => {
    const sg = subgraph(async () => ({ block: 100, timestamp: 1000 }))
    const { source, note } = await resolveSource(rpc, rpcClient, sg, 1000 + 213 * 86400)
    expect(source.kind).toBe('rpc')
    expect(note).toBe('subgraph is 213d behind')
  })

  describe('with a subgraph that stopped indexing', () => {
    const client = '0x5d85b986f4fa8e625111443c180a6a009efe46d0' as const
    const agent: AgentDetail = {
      chainId: 1,
      tokenId: 7n,
      owner: client,
      agentURI: null,
      agentWallet: null,
      reputation: { count: 2, average: 88.5 },
      // Index 2 is newer than the subgraph's last block.
      feedback: [
        { client, index: 2, value: 90, revoked: false },
        { client, index: 1, value: 88.5, revoked: false },
      ],
    }
    const live: DataSource = { ...rpc, getAgent: async () => agent }
    const stale = (getAgent: DataSource['getAgent']): SubgraphSource => ({
      ...subgraph(async () => ({ block: 100, timestamp: 1000 })),
      getAgent,
    })
    const now = 1000 + 213 * 86400

    it('dates old feedback from what the subgraph did index', async () => {
      const sg = stale(async () => ({
        ...agent,
        reputation: { count: 1, average: 1 },
        feedback: [{ client, index: 1, value: 88.5, revoked: false, createdAt: 1770751908, endpoint: 'https://a.example' }],
      }))
      const { source } = await resolveSource(live, rpcClient, sg, now)
      expect(await source.getAgent(7n)).toEqual({
        ...agent,
        feedback: [
          { client, index: 2, value: 90, revoked: false },
          { client, index: 1, value: 88.5, revoked: false, createdAt: 1770751908, endpoint: 'https://a.example' },
        ],
      })
    })

    it('keeps the RPC rows when the subgraph query fails', async () => {
      const sg = stale(async () => {
        throw new Error('timeout')
      })
      const { source } = await resolveSource(live, rpcClient, sg, now)
      expect(await source.getAgent(7n)).toEqual(agent)
    })
  })

  it('omits lag when the subgraph reports no block time', async () => {
    const sg = subgraph(async () => ({ block: 100 }))
    expect(await resolveSource(rpc, rpcClient, sg)).toEqual({ source: sg, rpcClient })
  })

  it('falls back to RPC with the reason when the subgraph fails', async () => {
    const sg = subgraph(async () => {
      throw new Error('indexing is unavailable')
    })
    expect(await resolveSource(rpc, rpcClient, sg)).toEqual({ source: rpc, rpcClient, note: 'indexing is unavailable' })
  })
})
