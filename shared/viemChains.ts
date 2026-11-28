import type { Chain } from 'viem';
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
} from 'viem/chains';

/** viem chain object per catalog id, shared by the browser clients and the indexer. */
const VIEM_CHAINS = new Map<number, Chain>([
  [421614, arbitrumSepolia],
  [42161, arbitrum],
  [8453, base],
  [56, bsc],
  [1, mainnet],
  [137, polygon],
  [143, monad],
  [5000, mantle],
  [11155111, sepolia],
  [84532, baseSepolia],
  [80002, polygonAmoy],
  [10143, monadTestnet],
  [5003, mantleSepoliaTestnet],
]);

export function viemChainFor(chainId: number): Chain {
  const chain = VIEM_CHAINS.get(chainId);

  if (!chain) throw new Error(`No viem chain for ${chainId}`);

  return chain;
}
