import type { Address, Chain } from 'viem'
import {
  arbitrum,
  arbitrumSepolia,
  base,
  baseSepolia,
  bsc,
  mainnet,
  mantle,
  mantleSepoliaTestnet,
  monad,
  monadTestnet,
  polygon,
  polygonAmoy,
  sepolia,
} from 'viem/chains'

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

const MAINNET = {
  testnet: false,
  scanUrl: 'https://8004scan.io',
  identity: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
  reputation: '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63',
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
  {
    ...MAINNET,
    chainId: 42161,
    name: 'Arbitrum',
    shortName: 'Arbitrum',
    slug: 'arbitrum',
    explorerUrl: 'https://arbiscan.io',
    explorerApiUrl: endpoint('EXPLORER_API', 42161, 'https://api.arbiscan.io/api'),
    rpcUrl: endpoint('RPC', 42161, 'https://arb1.arbitrum.io/rpc')!,
    viemChain: arbitrum,
    logRange: 10_000_000n,
    subgraphUrl: endpoint('SUBGRAPH', 42161),
  },
  {
    ...MAINNET,
    chainId: 8453,
    name: 'Base',
    shortName: 'Base',
    slug: 'base',
    explorerUrl: 'https://basescan.org',
    rpcUrl: endpoint('RPC', 8453, 'https://mainnet.base.org')!,
    viemChain: base,
    logRange: 10_000n,
    explorerApiUrl: endpoint('EXPLORER_API', 8453, 'https://base.blockscout.com/api'),
  },
  {
    ...MAINNET,
    chainId: 56,
    name: 'BSC',
    shortName: 'BSC',
    slug: 'bsc',
    explorerUrl: 'https://bscscan.com',
    rpcUrl: endpoint('RPC', 56, 'https://bsc-rpc.publicnode.com')!,
    viemChain: bsc,
    logRange: 5_000n,
  },
  {
    ...MAINNET,
    chainId: 1,
    name: 'Ethereum',
    shortName: 'Ethereum',
    slug: 'ethereum',
    explorerUrl: 'https://etherscan.io',
    explorerApiUrl: endpoint('EXPLORER_API', 1, 'https://eth.blockscout.com/api'),
    rpcUrl: endpoint('RPC', 1, 'https://ethereum-rpc.publicnode.com')!,
    viemChain: mainnet,
    logRange: 50_000n,
  },
  {
    ...MAINNET,
    chainId: 137,
    name: 'Polygon',
    shortName: 'Polygon',
    slug: 'polygon',
    explorerUrl: 'https://polygonscan.com',
    rpcUrl: endpoint('RPC', 137, 'https://polygon-bor-rpc.publicnode.com')!,
    viemChain: polygon,
    logRange: 10_000n,
  },
  {
    ...MAINNET,
    chainId: 143,
    name: 'Monad',
    shortName: 'Monad',
    slug: 'monad',
    explorerUrl: 'https://monadscan.com',
    rpcUrl: endpoint('RPC', 143, 'https://rpc.monad.xyz')!,
    viemChain: monad,
    logRange: 1_000n,
  },
  {
    ...TESTNET,
    chainId: 11155111,
    name: 'Ethereum Sepolia',
    shortName: 'Eth Sepolia',
    slug: 'sepolia',
    explorerUrl: 'https://sepolia.etherscan.io',
    explorerApiUrl: endpoint('EXPLORER_API', 11155111, 'https://eth-sepolia.blockscout.com/api'),
    rpcUrl: endpoint('RPC', 11155111, 'https://ethereum-sepolia-rpc.publicnode.com')!,
    viemChain: sepolia,
    logRange: 50_000n,
    subgraphUrl: endpoint(
      'SUBGRAPH',
      11155111,
      'https://gateway.thegraph.com/api/00a452ad3cd1900273ea62c1bf283f93/subgraphs/id/6wQRC7geo9XYAhckfmfo8kbMRLeWU8KQd3XsJqFKmZLT',
    ),
  },
  {
    ...TESTNET,
    chainId: 84532,
    name: 'Base Sepolia',
    shortName: 'Base Sepolia',
    slug: 'base-sepolia',
    explorerUrl: 'https://sepolia.basescan.org',
    explorerApiUrl: endpoint('EXPLORER_API', 84532, 'https://base-sepolia.blockscout.com/api'),
    rpcUrl: endpoint('RPC', 84532, 'https://sepolia.base.org')!,
    viemChain: baseSepolia,
    logRange: 1_000n,
    reputationFromBlock: 36_304_146n,
    subgraphUrl: endpoint(
      'SUBGRAPH',
      84532,
      'https://gateway.thegraph.com/api/536c6d8572876cabea4a4ad0fa49aa57/subgraphs/id/4yYAvQLFjBhBtdRCY7eUWo181VNoTSLLFd5M7FXQAi6u',
    ),
  },
  {
    ...MAINNET,
    chainId: 5000,
    name: 'Mantle',
    shortName: 'Mantle',
    slug: 'mantle',
    explorerUrl: 'https://mantlescan.io',
    explorerApiUrl: endpoint('EXPLORER_API', 5000, 'https://api.routescan.io/v2/network/mainnet/evm/5000/etherscan/api'),
    rpcUrl: endpoint('RPC', 5000, 'https://rpc.mantle.xyz')!,
    viemChain: mantle,
    logRange: 10_000n,
    // publicnode allows browser calls (CORS *) and a 5x wider log range.
    logsRpcUrl: endpoint('LOGS_RPC', 5000, 'https://mantle-rpc.publicnode.com'),
    logsLogRange: 50_000n,
    reputationFromBlock: 91_333_848n,
    subgraphUrl: endpoint('SUBGRAPH', 5000),
  },
  {
    ...TESTNET,
    chainId: 80002,
    name: 'Polygon Amoy',
    shortName: 'Polygon Amoy',
    slug: 'polygon-amoy',
    explorerUrl: 'https://amoy.polygonscan.com',
    rpcUrl: endpoint('RPC', 80002, 'https://polygon-amoy-bor-rpc.publicnode.com')!,
    viemChain: polygonAmoy,
    logRange: 1_000n,
  },
  {
    ...TESTNET,
    chainId: 10143,
    name: 'Monad Testnet',
    shortName: 'Monad Testnet',
    slug: 'monad-testnet',
    explorerUrl: 'https://testnet.monadexplorer.com',
    rpcUrl: endpoint('RPC', 10143, 'https://testnet-rpc.monad.xyz')!,
    viemChain: monadTestnet,
    logRange: 1_000n,
  },
  {
    ...TESTNET,
    chainId: 5003,
    name: 'Mantle Sepolia',
    shortName: 'Mnt Sepolia',
    slug: 'mantle-sepolia',
    explorerUrl: 'https://sepolia.mantlescan.io',
    rpcUrl: endpoint('RPC', 5003, 'https://rpc.sepolia.mantle.xyz')!,
    viemChain: mantleSepoliaTestnet,
    logRange: 10_000n,
    subgraphUrl: endpoint('SUBGRAPH', 5003),
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
