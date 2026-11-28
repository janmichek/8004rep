import { parseAbi } from 'viem';

/**
 * ERC-8004 Identity and Reputation events. The topic0 hashes are verified
 * against live deployments by `bun scripts/verify-erc8004-events.ts`.
 */
const IDENTITY_EVENTS = [
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
  'event Registered(uint256 indexed agentId, string agentURI, address indexed owner)',
  'event URIUpdated(uint256 indexed agentId, string newURI, address indexed updatedBy)',
  'event MetadataSet(uint256 indexed agentId, string indexed indexedMetadataKey, string metadataKey, bytes metadataValue)',
] as const;

const REPUTATION_EVENTS = [
  'event NewFeedback(uint256 indexed agentId, address indexed clientAddress, uint64 feedbackIndex, int128 value, uint8 valueDecimals, string indexed indexedTag1, string tag1, string tag2, string endpoint, string feedbackURI, bytes32 feedbackHash)',
  'event FeedbackRevoked(uint256 indexed agentId, address indexed clientAddress, uint64 indexed feedbackIndex)',
  'event ResponseAppended(uint256 indexed agentId, address indexed clientAddress, uint64 feedbackIndex, address indexed responder, string responseURI, bytes32 responseHash)',
] as const;

export const identityEventAbi = parseAbi(IDENTITY_EVENTS);
export const reputationEventAbi = parseAbi(REPUTATION_EVENTS);

/** Identity log topics by event name, for filters and verification. */
export const identityEventByName = {
  Transfer: identityEventAbi[0],
  Registered: identityEventAbi[1],
  URIUpdated: identityEventAbi[2],
  MetadataSet: identityEventAbi[3],
} as const;

/** Reputation log topics by event name, for filters and verification. */
export const reputationEventByName = {
  NewFeedback: reputationEventAbi[0],
  FeedbackRevoked: reputationEventAbi[1],
  ResponseAppended: reputationEventAbi[2],
} as const;

/** All eight event items, which is what a decoder loop needs. */
export const erc8004EventAbi = [...identityEventAbi, ...reputationEventAbi] as const;

/** The canonical `agentWallet` metadata key. */
export const AGENT_WALLET_KEY = 'agentWallet';
