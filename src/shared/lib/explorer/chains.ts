import type { Address, Chain } from 'viem';
import { CHAIN_CATALOG, type ChainRecord } from '@shared/chains';
import { viemChainFor } from '@shared/viemChains';

export type ChainInfo = ChainRecord & {
  rpcUrl: string;
  viemChain: Chain;
  identity: Address;
  reputation: Address;
  /** agent0 subgraph; chains without one are read over RPC only. */
  subgraphUrl?: string | undefined;
  /** Higher-limit endpoint for log scans, when one allows browser calls. */
  logsRpcUrl?: string | undefined;
  /** Reputation registry creation block; the log scan never goes below it. */
  reputationFromBlock?: bigint | undefined;
  /** Etherscan-compatible API that allows browser calls; absent = reviewer funding cannot be traced. */
  explorerApiUrl?: string | undefined;
};

const SUBGRAPHS: Record<number, string> = {
  8453: 'https://gateway.thegraph.com/api/536c6d8572876cabea4a4ad0fa49aa57/subgraphs/id/43s9hQRurMGjuYnC1r2ZwS6xSQktbFyXMPMqGKUFJojb',
  1: 'https://gateway.thegraph.com/api/7fd2e7d89ce3ef24cd0d4590298f0b2c/subgraphs/id/FV6RR6y13rsnCxBAicKuQEwDp8ioEGiNaWaZUmvr1F8k',
  137: 'https://gateway.thegraph.com/api/782d61ed390e625b8867995389699b4c/subgraphs/id/9q16PZv1JudvtnCAf44cBoxg82yK9SSsFvrjCY9xnneF',
  11155111:
    'https://gateway.thegraph.com/api/00a452ad3cd1900273ea62c1bf283f93/subgraphs/id/6wQRC7geo9XYAhckfmfo8kbMRLeWU8KQd3XsJqFKmZLT',
  84532:
    'https://gateway.thegraph.com/api/536c6d8572876cabea4a4ad0fa49aa57/subgraphs/id/4yYAvQLFjBhBtdRCY7eUWo181VNoTSLLFd5M7FXQAi6u',
};

const EXPLORER_APIS: Record<number, string> = {
  42161: 'https://api.arbiscan.io/api',
  8453: 'https://base.blockscout.com/api',
  1: 'https://eth.blockscout.com/api',
  11155111: 'https://eth-sepolia.blockscout.com/api',
  84532: 'https://base-sepolia.blockscout.com/api',
  5000: 'https://api.routescan.io/v2/network/mainnet/evm/5000/etherscan/api',
};

const env = import.meta.env as Record<string, string | undefined>;

/** `VITE_<KIND>_URL_<chainId>` replaces the built-in endpoint (kinds: RPC, LOGS_RPC, SUBGRAPH, EXPLORER_API). */
function endpoint(kind: string, chainId: number, fallback?: string): string | undefined {
  return env[`VITE_${kind}_URL_${chainId}`]?.trim() || fallback;
}

/** The shared catalog, mapped onto viem clients and build-time endpoint overrides. */
export const CHAINS: ChainInfo[] = CHAIN_CATALOG.map((record) => {
  const subgraphUrl = endpoint('SUBGRAPH', record.chainId, SUBGRAPHS[record.chainId]);
  const explorerApiUrl = endpoint('EXPLORER_API', record.chainId, EXPLORER_APIS[record.chainId]);
  const logsRpcUrl = endpoint('LOGS_RPC', record.chainId, record.defaultLogsRpcUrl);
  const reputationFromBlock = record.startBlock > 0n ? record.startBlock : undefined;

  return {
    ...record,
    rpcUrl: endpoint('RPC', record.chainId, record.defaultRpcUrl) ?? record.defaultRpcUrl,
    viemChain: viemChainFor(record.chainId),
    identity: record.identity,
    reputation: record.reputation,
    ...(subgraphUrl ? { subgraphUrl } : {}),
    ...(logsRpcUrl ? { logsRpcUrl } : {}),
    ...(record.logsLogRange ? { logsLogRange: record.logsLogRange } : {}),
    ...(reputationFromBlock ? { reputationFromBlock } : {}),
    ...(explorerApiUrl ? { explorerApiUrl } : {}),
  };
});

export const DEFAULT_CHAIN = CHAINS[0]!;

export function findChainBySlug(slug: string): ChainInfo | undefined {
  return CHAINS.find((c) => c.slug === slug);
}

export function addressExplorerUrl(chain: ChainInfo, address: string): string {
  return `${chain.explorerUrl}/address/${address}`;
}

export function txExplorerUrl(chain: ChainInfo, hash: string): string {
  return `${chain.explorerUrl}/tx/${hash}`;
}

/** 8004scan page of an agent. */
export function agentScanUrl(chain: ChainInfo, tokenId: bigint): string {
  return `${chain.scanUrl}/agents/${chain.slug}/${tokenId}`;
}

/** Route slug for "every network in the active environment" (owners, reviewers, feedbacks). */
export const ALL_NETWORKS = 'all';

export function chainById(chainId: number): ChainInfo | undefined {
  return CHAINS.find((c) => c.chainId === chainId);
}

/** The chains of one environment, in table order; the `all` scope and the picker share it. */
export function chainsOfEnv(testnet: boolean): ChainInfo[] {
  return CHAINS.filter((c) => c.testnet === testnet);
}

/** Chain ids as a readable list, for a cell title; an unknown id shows as its number. */
export function networkNames(chainIds: number[]): string {
  return chainIds.map((id) => chainById(id)?.shortName ?? String(id)).join(', ');
}
