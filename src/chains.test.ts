import { describe, expect, it } from 'vitest'
import {
  ALL_NETWORKS,
  CHAINS,
  DEFAULT_CHAIN,
  addressExplorerUrl,
  agentScanUrl,
  chainById,
  chainsOfEnv,
  findChainBySlug,
  networkNames,
  txExplorerUrl,
} from './chains'

const ADDRESS = '0x00000000000000000000000000000000000000a1'

describe('the chain table', () => {
  it('has a unique slug and chain id per row', () => {
    expect(new Set(CHAINS.map((c) => c.slug)).size).toBe(CHAINS.length)
    expect(new Set(CHAINS.map((c) => c.chainId)).size).toBe(CHAINS.length)
  })

  it('never uses the all-networks word as a chain slug, which would shadow the list route', () => {
    expect(CHAINS.some((c) => c.slug === ALL_NETWORKS)).toBe(false)
  })

  it('holds both environments, so each one has a fallback chain', () => {
    expect(CHAINS.some((c) => c.testnet)).toBe(true)
    expect(CHAINS.some((c) => !c.testnet)).toBe(true)
  })

  it('gives every row the endpoints the data layer dereferences without a check', () => {
    for (const chain of CHAINS) {
      expect(chain.rpcUrl, chain.slug).toMatch(/^https:\/\//)
      expect(chain.explorerUrl, chain.slug).toMatch(/^https:\/\//)
      expect(chain.logRange, chain.slug).toBeGreaterThan(0n)
    }
  })

  it('defaults to a row of the table', () => {
    expect(CHAINS).toContain(DEFAULT_CHAIN)
  })
})

describe('lookups', () => {
  it('finds a chain by slug and by id', () => {
    const chain = CHAINS[1]
    expect(findChainBySlug(chain.slug)).toBe(chain)
    expect(chainById(chain.chainId)).toBe(chain)
  })

  it('returns undefined for a slug or id it does not know', () => {
    expect(findChainBySlug('fantasy-net')).toBeUndefined()
    expect(findChainBySlug('')).toBeUndefined()
    expect(chainById(0)).toBeUndefined()
    expect(chainById(Number.NaN)).toBeUndefined()
  })
})

describe('chainsOfEnv', () => {
  it('splits the table into the two environments, keeping table order', () => {
    expect(chainsOfEnv(true)).toEqual(CHAINS.filter((c) => c.testnet))
    expect(chainsOfEnv(false)).toEqual(CHAINS.filter((c) => !c.testnet))
  })

  it('covers the whole table between them', () => {
    expect(chainsOfEnv(true).length + chainsOfEnv(false).length).toBe(CHAINS.length)
  })
})

describe('networkNames', () => {
  it('joins the short names of the chains it knows', () => {
    expect(networkNames([CHAINS[0].chainId, CHAINS[1].chainId])).toBe(`${CHAINS[0].shortName}, ${CHAINS[1].shortName}`)
  })

  it('falls back to the bare number for a chain the table does not hold', () => {
    expect(networkNames([999999])).toBe('999999')
  })

  it('is empty for no chains', () => {
    expect(networkNames([])).toBe('')
  })
})

describe('link builders', () => {
  const chain = CHAINS[0]

  it('builds address and transaction links on the chain explorer', () => {
    expect(addressExplorerUrl(chain, ADDRESS)).toBe(`${chain.explorerUrl}/address/${ADDRESS}`)
    expect(txExplorerUrl(chain, '0xabc')).toBe(`${chain.explorerUrl}/tx/0xabc`)
  })

  it('builds the 8004scan agent link from the chain slug and token id', () => {
    expect(agentScanUrl(chain, 42n)).toBe(`${chain.scanUrl}/agents/${chain.slug}/42`)
  })
})
