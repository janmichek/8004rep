import { ALL_NETWORKS, CHAINS, findChainBySlug, type ChainInfo } from './chains';
import type { NetworkEnv } from './env';

export function chainsForEnv(env: NetworkEnv): ChainInfo[] {
  return CHAINS.filter((chain) => chain.testnet === (env === 'testnet'));
}

function resolveListChainId(slug: string, env: NetworkEnv): number | undefined {
  if (slug === ALL_NETWORKS) return undefined;

  const chain = findChainBySlug(slug);

  if (!chain) return undefined;

  if (chain.testnet !== (env === 'testnet')) return undefined;

  return chain.chainId;
}
