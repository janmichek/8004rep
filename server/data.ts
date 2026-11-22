import type { Agent, Network } from '../shared/schemas';

// oxfmt-ignore
export const agents: Agent[] = [
  { id: 1, network: 'BASE', name: 'Atlas Broker', owner: '0x1111111111111111111111111111111111111111', feedbackCount: 18, score: 0.72, status: 'active', registeredAt: '2025-01-06T09:14:00Z' },
  { id: 2, network: 'ARB', name: 'Nova Scout', owner: '0x2222222222222222222222222222222222222222', feedbackCount: 9, score: 0.41, status: 'quiet', registeredAt: '2025-02-03T11:47:00Z' },
  { id: 3, network: 'ETH', name: 'Ledger Mint', owner: '0x3333333333333333333333333333333333333333', feedbackCount: 27, score: 0.88, status: 'active', registeredAt: '2025-03-19T13:05:00Z' },
  { id: 4, network: 'OP', name: 'Relay Desk', owner: '0x4444444444444444444444444444444444444444', feedbackCount: 4, score: 0.55, status: 'quiet', registeredAt: '2025-04-07T07:58:00Z' },
  { id: 5, network: 'SEP', name: 'Sandbox Pilot', owner: '0x5555555555555555555555555555555555555555', feedbackCount: 0, score: null, status: 'unreviewed', registeredAt: '2025-05-09T10:11:00Z' },
  { id: 6, network: 'BASE', name: 'Harbor Index', owner: '0x6666666666666666666666666666666666666666', feedbackCount: 14, score: 0.63, status: 'active', registeredAt: '2025-06-12T12:26:00Z' },
  { id: 7, network: 'ARB', name: 'Quorum Watch', owner: '0x7777777777777777777777777777777777777777', feedbackCount: 0, score: null, status: 'unreviewed', registeredAt: '2025-07-15T09:51:00Z' },
  { id: 8, network: 'ETH', name: 'Signal Mesh', owner: '0x8888888888888888888888888888888888888888', feedbackCount: 21, score: 0.79, status: 'active', registeredAt: '2025-09-25T17:20:00Z' },
  { id: 9, network: 'OP', name: 'Parcel Agent', owner: '0x9999999999999999999999999999999999999999', feedbackCount: 6, score: 0.36, status: 'quiet', registeredAt: '2025-11-02T20:48:00Z' },
  { id: 10, network: 'BASE', name: 'Coral Oracle', owner: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', feedbackCount: 11, score: 0.67, status: 'active', registeredAt: '2026-01-09T10:27:00Z' },
  { id: 11, network: 'ARB', name: 'Drift Courier', owner: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', feedbackCount: 3, score: 0.22, status: 'quiet', registeredAt: '2026-02-11T16:41:00Z' },
  { id: 12, network: 'ETH', name: 'Prime Registrar', owner: '0xcccccccccccccccccccccccccccccccccccccccc', feedbackCount: 32, score: 0.91, status: 'active', registeredAt: '2026-03-18T10:52:00Z' },
];

// oxfmt-ignore
export const networks: Network[] = [
  { code: 'BASE', name: 'Base', symbol: 'B', color: 'blue', chainId: 8453, testnet: false },
  { code: 'ARB', name: 'Arbitrum', symbol: 'A', color: 'iris', chainId: 42161, testnet: false },
  { code: 'ETH', name: 'Ethereum', symbol: 'Ξ', color: 'teal', chainId: 1, testnet: false },
  { code: 'OP', name: 'Optimism', symbol: 'O', color: 'orange', chainId: 10, testnet: false },
  { code: 'SEP', name: 'Sepolia', symbol: 'S', color: 'gray', chainId: 11155111, testnet: true },
];
