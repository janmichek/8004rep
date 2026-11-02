import { describe, expect, it, vi } from 'vitest'
import { computed, shallowRef } from 'vue'
import type { Address } from 'viem'
import { CHAINS, type ChainInfo } from './chains'
import type { FeedbackPage } from './data/types'

const A: Address = '0x00000000000000000000000000000000000000a1'

/** What each chain's source answers, by chain id; set per test. */
const pages = new Map<number, FeedbackPage>()

vi.mock('./data', () => ({
  sourceFor: async (chain: ChainInfo) => ({
    source: { listFeedback: async () => pages.get(chain.chainId) ?? { items: [] } },
  }),
}))

const { useFeedRows } = await import('./useFeedRows')

const [a, b] = CHAINS as [ChainInfo, ChainInfo]

function scopeOf(chains: ChainInfo[], all = chains.length > 1) {
  const list = shallowRef(chains)
  return { all: computed(() => all), chains: computed(() => list.value), key: computed(() => list.value.map((c) => c.chainId).join(',')) }
}

async function settle(check: () => boolean): Promise<void> {
  await vi.waitFor(() => {
    if (!check()) throw new Error('not settled')
  })
}

function row(tokenId: bigint, chainId?: number) {
  return { client: A, value: 70, revoked: false, tokenId, ...(chainId !== undefined ? { chainId } : {}) }
}

describe('useFeedRows', () => {
  it('flattens every chain of the scope and stamps each row with the chain it came from', async () => {
    pages.clear()
    pages.set(a.chainId, { items: [row(1n)] })
    pages.set(b.chainId, { items: [row(1n)] })

    const { rows, loaded } = useFeedRows(scopeOf([a, b]), { minRows: 1, maxSteps: 1 })
    await settle(() => loaded.value)

    expect(rows.value.map((r) => r.chainId).sort()).toEqual([a.chainId, b.chainId].sort())
  })

  it('leaves a chain id the source already set, so a cross-chain source stays right', async () => {
    pages.clear()
    pages.set(a.chainId, { items: [row(1n, 999)] })

    const { rows, loaded } = useFeedRows(scopeOf([a]), { minRows: 1, maxSteps: 1 })
    await settle(() => loaded.value)

    expect(rows.value[0].chainId).toBe(999)
  })

  it('offers more when any chain still has a cursor', async () => {
    pages.clear()
    pages.set(a.chainId, { items: [row(1n)] })
    pages.set(b.chainId, { items: [row(2n)], cursor: 'c1' })

    const { hasMore, loaded } = useFeedRows(scopeOf([a, b]), { minRows: 1, maxSteps: 1 })
    await settle(() => loaded.value)

    expect(hasMore.value).toBe(true)
  })

  it('reports how far back a single chain scanned, and nothing across networks', async () => {
    pages.clear()
    pages.set(a.chainId, { items: [row(1n)], since: 1_700_000_000 })
    pages.set(b.chainId, { items: [row(2n)], since: 1_600_000_000 })

    const one = useFeedRows(scopeOf([a], false), { minRows: 1, maxSteps: 1 })
    await settle(() => one.loaded.value)
    expect(one.since.value).toBe(1_700_000_000)

    const many = useFeedRows(scopeOf([a, b], true), { minRows: 1, maxSteps: 1 })
    await settle(() => many.loaded.value)
    expect(many.since.value).toBeUndefined()
  })
})
