import { parseAbi } from 'viem'

export const identityAbi = parseAbi([
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function balanceOf(address owner) view returns (uint256)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function getAgentWallet(uint256 agentId) view returns (address)',
  'error ERC721NonexistentToken(uint256 tokenId)',
])

const NEW_FEEDBACK =
  'event NewFeedback(uint256 indexed agentId, address indexed clientAddress, uint64 feedbackIndex, int128 value, uint8 valueDecimals, string indexed indexedTag1, string tag1, string tag2, string endpoint, string feedbackURI, bytes32 feedbackHash)' as const
const FEEDBACK_REVOKED =
  'event FeedbackRevoked(uint256 indexed agentId, address indexed clientAddress, uint64 indexed feedbackIndex)' as const

const RESPONSE_APPENDED =
  'event ResponseAppended(uint256 indexed agentId, address indexed clientAddress, uint64 feedbackIndex, address indexed responder, string responseURI, bytes32 responseHash)' as const

/** Single event items, for `getLogs` (viem infers the log args from these). */
export const newFeedbackEvent = parseAbi([NEW_FEEDBACK])[0]
export const feedbackRevokedEvent = parseAbi([FEEDBACK_REVOKED])[0]
export const responseAppendedEvent = parseAbi([RESPONSE_APPENDED])[0]

export const reputationAbi = parseAbi([
  'function getClients(uint256 agentId) view returns (address[])',
  'function getSummary(uint256 agentId, address[] clientAddresses, string tag1, string tag2) view returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals)',
  'function readAllFeedback(uint256 agentId, address[] clientAddresses, string tag1, string tag2, bool includeRevoked) view returns (address[] clients, uint64[] feedbackIndexes, int128[] values, uint8[] valueDecimals, string[] tag1s, string[] tag2s, bool[] revokedStatuses)',
  NEW_FEEDBACK,
  FEEDBACK_REVOKED,
])
