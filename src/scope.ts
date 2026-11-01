import { computed } from 'vue'
import { CHAINS, findChainBySlug, ALL_NETWORKS, type ChainInfo } from './chains'
import { errorMessage } from './format'
import { networkEnv } from './env'

/**
 * Which chains a list page reads: one chain for a chain slug, every chain of the
 * active environment for `all`. `key` changes whenever that set changes, so pages
 * reload on a new chain, and on a Mainnet/Testnet switch while on `all`.
 */
export function useScope(slug: () => string) {
  const all = computed(() => slug() === ALL_NETWORKS)
  const chains = computed<ChainInfo[]>(() => {
    if (!all.value) {
      const chain = findChainBySlug(slug())
      return chain ? [chain] : []
    }
    const testnet = networkEnv.value === 'testnet'
    return CHAINS.filter((c) => c.testnet === testnet)
  })
  const key = computed(() => chains.value.map((c) => c.chainId).join(','))
  return { all, chains, key }
}

export type ChainFailure = { chain: ChainInfo; message: string }

/**
 * Runs `load` for each chain in turn (one RPC scan at a time keeps the public
 * endpoints happy). A chain that throws is reported, not fatal, so the rest of
 * an all-networks view still shows.
 */
export async function loadChains<T>(
  chains: ChainInfo[],
  load: (chain: ChainInfo) => Promise<T>,
): Promise<{ values: { chain: ChainInfo; value: T }[]; failed: ChainFailure[] }> {
  const values: { chain: ChainInfo; value: T }[] = []
  const failed: ChainFailure[] = []
  for (const chain of chains) {
    try {
      values.push({ chain, value: await load(chain) })
    } catch (err) {
      failed.push({ chain, message: errorMessage(err) })
    }
  }
  return { values, failed }
}
