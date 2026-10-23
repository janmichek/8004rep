import type { Address, Chain } from 'viem'
import { arbitrumSepolia } from 'viem/chains'

export type ChainInfo = {
  chainId: number
  name: string
  /** Compact label for the chain picker. */
  shortName: string
  /** Route segment; same as the network segment of 8004scan agent URLs. */
  slug: string
  testnet: boolean
  explorerUrl: string
  /** 8004scan site listing this network's agents. */
  scanUrl: string
  /** Keyless, CORS-enabled RPC. */
  rpcUrl: string
  viemChain: Chain
  identity: Address
  reputation: Address
  /** agent0 subgraph; chains without one are read over RPC only. */
  subgraphUrl?: string
  /** Max `eth_getLogs` block range of `rpcUrl`. */
  logRange: bigint
  /** Higher-limit endpoint for log scans, when one allows browser calls. */
  logsRpcUrl?: string
  /** Its max `eth_getLogs` range; defaults to `logRange`. */
  logsLogRange?: bigint
  /** Reputation registry creation block; the log scan never goes below it. */
  reputationFromBlock?: bigint
  /** Etherscan-compatible API that allows browser calls; absent = reviewer funding cannot be traced. */
  explorerApiUrl?: string
}

// ERC-8004 registries share one address per chain family.
const TESTNET = {
  testnet: true,
  scanUrl: 'https://testnet.8004scan.io',
  identity: '0x8004A818BFB912233c491871b3d84c89A494BD9e',
  reputation: '0x8004B663056A597Dffe9eCcC1965A193B7388713',
} as const

const env = import.meta.env as Record<string, string | undefined>

/** `VITE_<KIND>_URL_<chainId>` replaces the built-in endpoint (kinds: RPC, LOGS_RPC, SUBGRAPH, EXPLORER_API). */
function endpoint(kind: string, chainId: number, fallback?: string): string | undefined {
  return env[`VITE_${kind}_URL_${chainId}`]?.trim() || fallback
}

// Subgraph URLs are the public defaults shipped in @blockbyvlog/agent0-sdk.
export const CHAINS: ChainInfo[] = [
  {
    ...TESTNET,
    chainId: 421614,
    name: 'Arbitrum Sepolia',
    shortName: 'Arb Sepolia',
    slug: 'arbitrum-sepolia',
    explorerUrl: 'https://sepolia.arbiscan.io',
    rpcUrl: endpoint('RPC', 421614, 'https://sepolia-rollup.arbitrum.io/rpc')!,
    viemChain: arbitrumSepolia,
    logRange: 10_000_000n,
    subgraphUrl: endpoint(
      'SUBGRAPH',
      421614,
      'https://api.studio.thegraph.com/query/1741985/erc-8004-arbitrum-testnet/version/latest',
    ),
  },
]

export const DEFAULT_CHAIN = CHAINS[0]

export function findChainBySlug(slug: string): ChainInfo | undefined {
  return CHAINS.find((c) => c.slug === slug)
}

export function addressExplorerUrl(chain: ChainInfo, address: string): string {
  return `${chain.explorerUrl}/address/${address}`
}

export function txExplorerUrl(chain: ChainInfo, hash: string): string {
  return `${chain.explorerUrl}/tx/${hash}`
}

/** 8004scan page of an agent. */
export function agentScanUrl(chain: ChainInfo, tokenId: bigint): string {
  return `${chain.scanUrl}/agents/${chain.slug}/${tokenId}`
}
