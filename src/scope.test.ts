import { afterEach, describe, expect, it } from 'vitest'
import { shallowRef } from 'vue'
import { ALL_NETWORKS, CHAINS, type ChainInfo } from './chains'
import { setNetworkEnv } from './env'
import { loadChains, useScope } from './scope'

const MAINNET = CHAINS.filter((c) => !c.testnet)
const TESTNET = CHAINS.filter((c) => c.testnet)

afterEach(() => setNetworkEnv('mainnet'))

describe('useScope', () => {
  it('reads one chain for a chain slug', () => {
    const chain = MAINNET[0]
    const scope = useScope(() => chain.slug)
    expect(scope.all.value).toBe(false)
    expect(scope.chains.value).toEqual([chain])
    expect(scope.key.value).toBe(String(chain.chainId))
  })

  it('reads nothing for a slug that names no chain', () => {
    const scope = useScope(() => 'not-a-network')
    expect(scope.chains.value).toEqual([])
    expect(scope.key.value).toBe('')
  })

  it('reads every chain of the active environment for `all`', () => {
    const scope = useScope(() => ALL_NETWORKS)
    expect(scope.all.value).toBe(true)
    expect(scope.chains.value).toEqual(MAINNET)
    expect(scope.chains.value.every((c) => !c.testnet)).toBe(true)
  })

  it('swaps the chain set, and so the key, when the environment switches under `all`', () => {
    const scope = useScope(() => ALL_NETWORKS)
    const before = scope.key.value
    setNetworkEnv('testnet')
    expect(scope.chains.value).toEqual(TESTNET)
    expect(scope.key.value).not.toBe(before)
  })

  it('ignores the environment on a chain slug, so a testnet link opens under Mainnet', () => {
    const scope = useScope(() => TESTNET[0].slug)
    expect(scope.chains.value).toEqual([TESTNET[0]])
  })

  it('follows a changing slug', () => {
    const slug = shallowRef(MAINNET[0].slug)
    const scope = useScope(() => slug.value)
    slug.value = MAINNET[1].slug
    expect(scope.chains.value).toEqual([MAINNET[1]])
  })
})

describe('loadChains', () => {
  const [a, b] = CHAINS as [ChainInfo, ChainInfo]

  it('runs the loaders one after another and keeps each value with its chain', async () => {
    const order: number[] = []
    const result = await loadChains([a, b], async (chain) => {
      order.push(chain.chainId)
      return chain.chainId * 2
    })
    expect(order).toEqual([a.chainId, b.chainId])
    expect(result.values).toEqual([
      { chain: a, value: a.chainId * 2 },
      { chain: b, value: b.chainId * 2 },
    ])
    expect(result.failed).toEqual([])
  })

  it('reports a failing chain without losing the others', async () => {
    const result = await loadChains([a, b], async (chain) => {
      if (chain === a) throw new Error('rpc down')
      return 'ok'
    })
    expect(result.values).toEqual([{ chain: b, value: 'ok' }])
    expect(result.failed).toEqual([{ chain: a, message: 'rpc down' }])
  })

  it('reports every chain when all of them fail', async () => {
    const result = await loadChains([a, b], async () => {
      throw new Error('nope')
    })
    expect(result.values).toEqual([])
    expect(result.failed.map((f) => f.chain)).toEqual([a, b])
  })

  it('returns empty results for an empty scope, without calling the loader', async () => {
    let calls = 0
    const result = await loadChains([], async () => void calls++)
    expect(calls).toBe(0)
    expect(result).toEqual({ values: [], failed: [] })
  })
})
