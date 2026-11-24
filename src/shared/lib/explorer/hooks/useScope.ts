import { ALL_NETWORKS, chainsOfEnv, findChainBySlug, type ChainInfo } from '../chains';
import { useNetworkEnv } from '../useNetworkEnv';

/**
 * Which chains a list page reads: one chain for a chain slug, every chain of the
 * active environment for `all`. `key` changes whenever that set changes, so pages
 * reload on a new chain, and on a Mainnet/Testnet switch while on `all`.
 */
export function useScope(slug: string) {
  const [env] = useNetworkEnv();
  const all = slug === ALL_NETWORKS;
  const chain = findChainBySlug(slug);
  const chains: ChainInfo[] = all ? chainsOfEnv(env === 'testnet') : chain ? [chain] : [];
  const key = chains.map((item) => item.chainId).join(',');
  return { all, chains, key };
}

export type Scope = ReturnType<typeof useScope>;
