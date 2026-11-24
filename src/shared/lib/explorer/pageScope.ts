import { ALL_NETWORKS, CHAINS, findChainBySlug, type ChainInfo } from './chains';
import type { ScanChain } from './data/scan';
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

function resolveAgentRef(
  slug: string,
  scanChains: ScanChain[]
): { chainId: number; name: string; key: string; testnet: boolean } | undefined {
  const configured = findChainBySlug(slug);

  if (configured) {
    return {
      chainId: configured.chainId,
      name: configured.name,
      key: configured.slug,
      testnet: configured.testnet,
    };
  }

  const byKey = scanChains.find((chain) => chain.key === slug);

  if (byKey) {
    return { chainId: byKey.chainId, name: byKey.name, key: byKey.key, testnet: byKey.testnet };
  }

  const asId = Number(slug);

  if (!Number.isInteger(asId)) return undefined;

  const byId = scanChains.find((chain) => chain.chainId === asId);

  if (byId) {
    return { chainId: byId.chainId, name: byId.name, key: byId.key, testnet: byId.testnet };
  }

  return { chainId: asId, name: `Chain ${asId}`, key: String(asId), testnet: false };
}

function agentPathSlug(chainId: number, scanChains: Map<number, ScanChain>): string {
  const configured = CHAINS.find((chain) => chain.chainId === chainId);

  if (configured) return configured.slug;

  return scanChains.get(chainId)?.key ?? String(chainId);
}

function buildScanFeedbackParams(
  env: NetworkEnv,
  chainId: number | undefined,
  pageSize: number
): { page: number; pageSize: number; isTestnet: boolean; chainId?: number } {
  const params: { page: number; pageSize: number; isTestnet: boolean; chainId?: number } = {
    page: 0,
    pageSize,
    isTestnet: env === 'testnet',
  };

  if (chainId !== undefined) params.chainId = chainId;

  return params;
}
