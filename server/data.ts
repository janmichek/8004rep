import type { Network } from '../shared/schemas';

// oxfmt-ignore
export const networks: Network[] = [
  { code: 'BASE', name: 'Base', symbol: 'B', color: 'blue', chainId: 8453, testnet: false },
  { code: 'ARB', name: 'Arbitrum', symbol: 'A', color: 'iris', chainId: 42161, testnet: false },
  { code: 'ETH', name: 'Ethereum', symbol: 'Ξ', color: 'teal', chainId: 1, testnet: false },
  { code: 'OP', name: 'Optimism', symbol: 'O', color: 'orange', chainId: 10, testnet: false },
  { code: 'SEP', name: 'Sepolia', symbol: 'S', color: 'gray', chainId: 11155111, testnet: true },
];
