import { describe, expect, it } from 'vitest'
import { ContractFunctionRevertedError, type Address, type PublicClient } from 'viem'
import { identityAbi, reputationAbi } from '../abi'
import { createRpcSource, findCount, getScores, zipFeedback } from './rpc'
import type { ChainInfo } from '../chains'

/** Registry with ids 0..count-1; records how many probes were made. */
function registry(count: bigint) {
  const state = { calls: 0 }
  const exists = async (id: bigint) => {
    state.calls++
    return id >= 0n && id < count
  }
  return { exists, state }
}

describe('findCount', () => {
  it.each([0n, 1n, 2n, 3n, 4n, 51n, 63n, 64n, 65n, 1000n, 123457n])('finds %d tokens', async (count) => {
    expect(await findCount(registry(count).exists)).toBe(count)
  })

  it('stays logarithmic', async () => {
    const { exists, state } = registry(1_000_000n)
    await findCount(exists)
    expect(state.calls).toBeLessThan(50)
  })

  it('resumes from a hint in a few probes', async () => {
    const { exists, state } = registry(1003n)
    expect(await findCount(exists, 1000n)).toBe(1003n)
    expect(state.calls).toBeLessThan(8)
  })

  it('needs two probes when the hint is still exact', async () => {
    const { exists, state } = registry(500n)
    expect(await findCount(exists, 500n)).toBe(500n)
    expect(state.calls).toBe(2)
  })

  it('ignores a hint that is too high', async () => {
    expect(await findCount(registry(10n).exists, 999n)).toBe(10n)
  })

  it('propagates probe failures instead of treating them as the end', async () => {
    const exists = async (id: bigint) => {
      if (id > 5n) throw new Error('rate limited')
      return true
    }
    await expect(findCount(exists)).rejects.toThrow('rate limited')
  })
})

describe('zipFeedback', () => {
  it('builds reviews and applies value decimals', () => {
    const rows = zipFeedback([
      ['0x00000000000000000000000000000000000000a1', '0x00000000000000000000000000000000000000b2'],
      [1n, 1n],
      [85n, 9050n],
      [0, 2],
      ['starred', ''],
      ['', 'swap'],
      [false, true],
    ])
    expect(rows).toEqual([
      { client: '0x00000000000000000000000000000000000000a1', index: 1, value: 85, tag1: 'starred', revoked: false },
      { client: '0x00000000000000000000000000000000000000b2', index: 1, value: 90.5, tag2: 'swap', revoked: true },
    ])
  })
})

describe('getScores', () => {
  const A = '0x00000000000000000000000000000000000000a1' as Address
  const chain = { chainId: 1, reputation: '0x00000000000000000000000000000000000000ff' } as unknown as ChainInfo

  /** Fake registry: token → clients; missing tokens revert like the real contract. */
  function fakeRegistry(clients: Record<string, Address[]>) {
    return {
      async readContract({ functionName, args }: { functionName: string; args: readonly unknown[] }) {
        const tokenId = args[0] as bigint
        if (functionName === 'getClients') {
          const entry = clients[tokenId.toString()]
          if (entry === undefined)
            throw new ContractFunctionRevertedError({ abi: reputationAbi, functionName: 'getClients' })
          return entry
        }
        if (functionName === 'getSummary') return [2n, 175n, 1] as const
        throw new Error(`unexpected ${functionName}`)
      },
    } as unknown as PublicClient
  }

  it('maps agents with clients to count and average, empty ones to zero', async () => {
    const scores = await getScores(fakeRegistry({ 1: [A], 2: [] }), chain, [1n, 2n])
    expect(scores.get(1n)).toEqual({ count: 2, average: 17.5 })
    expect(scores.get(2n)).toEqual({ count: 0, average: 0 })
  })

  it('skips reverted reads', async () => {
    const scores = await getScores(fakeRegistry({}), chain, [9n])
    expect(scores.has(9n)).toBe(false)
  })

  it('caps the client list and marks the review', async () => {
    const many = Array.from({ length: 250 }, (_, i) => `0x${String(i + 1).padStart(40, '0')}` as Address)
    let seen: unknown[] = []
    const client = {
      async readContract(params: { functionName: string; args: readonly unknown[] }) {
        if (params.functionName === 'getClients') return many
        if (params.functionName === 'getSummary') {
          seen = params.args[1] as unknown[]
          return [250n, 100n, 0] as const
        }
        throw new Error('unexpected')
      },
    } as unknown as PublicClient
    const scores = await getScores(client, chain, [3n])
    expect(scores.get(3n)).toMatchObject({ capped: true })
    expect(seen).toHaveLength(200)
  })
})

describe('listAgents by owner', () => {
  const A = '0x00000000000000000000000000000000000000aa' as Address
  const B = '0x00000000000000000000000000000000000000bb' as Address
  const chain = { chainId: 1, identity: '0x00000000000000000000000000000000000000ff' } as unknown as ChainInfo
  // Ids 0..3 exist. A owns 1 and 2.
  const holders: Record<string, Address> = { 0: B, 1: A, 2: A, 3: B }

  function registry() {
    const calls = { ownerOf: 0 }
    const client = {
      async readContract({ functionName, args }: { functionName: string; args: readonly unknown[] }) {
        if (functionName === 'balanceOf') {
          const who = String(args[0]).toLowerCase()
          return BigInt(Object.values(holders).filter((owner) => owner.toLowerCase() === who).length)
        }
        if (functionName === 'ownerOf') {
          calls.ownerOf++
          const id = (args[0] as bigint).toString()
          const owner = holders[id]
          if (!owner) throw new ContractFunctionRevertedError({ abi: identityAbi, functionName: 'ownerOf' })
          return owner
        }
        if (functionName === 'tokenURI') return ''
        throw new Error(`unexpected ${functionName}`)
      },
    } as unknown as PublicClient
    return { client, calls }
  }

  it('returns that address’s agents, newest first, and pages them', async () => {
    const { client } = registry()
    const source = createRpcSource(chain, client)
    const first = await source.listAgents({ page: 0, pageSize: 1, owner: A })
    expect(first.total).toBe(2)
    expect(first.hasMore).toBe(true)
    expect(first.items.map((agent) => agent.tokenId)).toEqual([2n])
    const second = await source.listAgents({ page: 1, pageSize: 1, owner: A })
    expect(second.items.map((agent) => agent.tokenId)).toEqual([1n])
    expect(second.hasMore).toBe(false)
  })

  it('matches the owner regardless of checksum case', async () => {
    const { client } = registry()
    const source = createRpcSource(chain, client)
    const owned = await source.listAgents({ page: 0, pageSize: 10, owner: A.toUpperCase() as Address })
    expect(owned.items.map((agent) => agent.tokenId)).toEqual([2n, 1n])
  })

  it('does not scan token owners when the balance is zero', async () => {
    const { client, calls } = registry()
    const source = createRpcSource(chain, client)
    const empty = await source.listAgents({
      page: 0,
      pageSize: 10,
      owner: '0x00000000000000000000000000000000000000cc' as Address,
    })
    expect(empty).toEqual({ items: [], total: 0, hasMore: false })
    expect(calls.ownerOf).toBe(0)
  })
})
