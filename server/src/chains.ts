import type { Address, Chain } from 'viem'
import { base, mainnet, mantle } from 'viem/chains'

/**
 * Server-side chain facts. The browser copy lives in `src/chains.ts`; this one
 * adds private endpoint overrides and indexing limits, and never reads Vite
 * env, so the same file runs under Node and in the Docker image.
 */
export type ServerChain = {
  chainId: number
  name: string
  shortName: string
  slug: string
  testnet: boolean
  explorerUrl: string
  scanUrl: string
  /** Public RPC; `RPC_URL_<chainId>` overrides it. */
  rpcUrl: string
  /** Second public endpoint, used when the first rate-limits. */
  fallbackRpcUrl?: string
  viemChain: Chain
  identity: Address
  reputation: Address
  subgraphUrl?: string
  logRange: bigint
  reputationFromBlock?: bigint
  /** Newest agents kept in SQLite. Base has millions; the API says so. */
  agentLimit: number
  /** Newest feedback rows kept in SQLite. */
  feedbackLimit: number
}

const MAINNET = {
  testnet: false,
  scanUrl: 'https://8004scan.io',
  identity: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
  reputation: '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63',
} as const

function rpc(chainId: number, fallback: string): string {
  return process.env[`RPC_URL_${chainId}`]?.trim() || fallback
}

export const CHAINS: ServerChain[] = [
  {
    ...MAINNET,
    chainId: 8453,
    name: 'Base',
    shortName: 'Base',
    slug: 'base',
    explorerUrl: 'https://basescan.org',
    rpcUrl: rpc(8453, 'https://base-rpc.publicnode.com'),
    viemChain: base,
    logRange: 10_000n,
    agentLimit: Number(process.env.AGENT_LIMIT_8453 ?? 12_000),
    feedbackLimit: Number(process.env.FEEDBACK_LIMIT_8453 ?? 30_000),
    subgraphUrl:
      process.env.SUBGRAPH_URL_8453?.trim() ||
      'https://gateway.thegraph.com/api/536c6d8572876cabea4a4ad0fa49aa57/subgraphs/id/43s9hQRurMGjuYnC1r2ZwS6xSQktbFyXMPMqGKUFJojb',
  },
  {
    ...MAINNET,
    chainId: 1,
    name: 'Ethereum',
    shortName: 'Ethereum',
    slug: 'ethereum',
    explorerUrl: 'https://etherscan.io',
    rpcUrl: rpc(1, 'https://ethereum-rpc.publicnode.com'),
    viemChain: mainnet,
    logRange: 50_000n,
    agentLimit: Number(process.env.AGENT_LIMIT_1 ?? 60_000),
    feedbackLimit: Number(process.env.FEEDBACK_LIMIT_1 ?? 40_000),
    subgraphUrl:
      process.env.SUBGRAPH_URL_1?.trim() ||
      'https://gateway.thegraph.com/api/7fd2e7d89ce3ef24cd0d4590298f0b2c/subgraphs/id/FV6RR6y13rsnCxBAicKuQEwDp8ioEGiNaWaZUmvr1F8k',
  },
  {
    ...MAINNET,
    chainId: 5000,
    name: 'Mantle',
    shortName: 'Mantle',
    slug: 'mantle',
    explorerUrl: 'https://mantlescan.io',
    rpcUrl: rpc(5000, 'https://mantle.drpc.org'),
    fallbackRpcUrl: 'https://mantle-rpc.publicnode.com',
    viemChain: mantle,
    logRange: 10_000n,
    reputationFromBlock: 91_333_848n,
    agentLimit: Number(process.env.AGENT_LIMIT_5000 ?? 1_000),
    feedbackLimit: Number(process.env.FEEDBACK_LIMIT_5000 ?? 5_000),
  },
]

export function chainById(chainId: number): ServerChain | undefined {
  return CHAINS.find((chain) => chain.chainId === chainId)
}

export function enabledChains(): ServerChain[] {
  const raw = process.env.ENABLED_CHAINS?.trim()
  if (!raw) return CHAINS
  const ids = new Set(raw.split(',').map((value) => Number(value.trim())))
  return CHAINS.filter((chain) => ids.has(chain.chainId))
}
