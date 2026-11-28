/** One agent as the owned API lists it; the UI compares `tokenId` as a bigint. */
export type IndexedAgent = {
  chainId: number;
  tokenId: bigint;
  name?: string;
  description?: string;
  imageUrl?: string;
  owner: string | null;
  protocols: string[];
  x402: boolean;
  /** 0–100 `rep-1.0` filtered score; null when unrated. */
  score: number | null;
  ciLow: number | null;
  ciHigh: number | null;
  confidence: 'low' | 'medium' | 'high';
  unrated: boolean;
  rawAverage: number | null;
  ratedRows: number;
  uniqueWallets: number;
  feedbackCount: number;
  formulaVersion: 'rep-1.0';
  /** Unix seconds. */
  createdAt?: number;
  testnet: boolean;
};

export type IndexedAgentPage = { items: IndexedAgent[]; total: number; hasMore: boolean };

import { getAddress, type Address } from 'viem';
import type { AgentDetailResponse, AgentReputationResponse } from '@shared/schemas';
import type { Feedback, FeedbackResponse } from './types';
import type { AgentDetail } from './types';
import type { TagScale } from '@shared/reputation';

/** A valid address from the index, or null when the stored value is malformed. */
function toAddress(value: string | null): Address | null {
  if (!value) return null;

  try {
    return getAddress(value);
  } catch {
    return null;
  }
}

function toResponse(
  row: AgentDetailResponse['feedback'][number]['responses'][number]
): FeedbackResponse | null {
  const responder = toAddress(row.responder);

  if (!responder) return null;

  return {
    responder,
    ...(row.uri ? { uri: row.uri } : {}),
    ...(row.createdAt !== null ? { createdAt: row.createdAt } : {}),
    ...(row.txHash ? { txHash: row.txHash as `0x${string}` } : {}),
  };
}

function toFeedback(row: AgentDetailResponse['feedback'][number]): Feedback | null {
  const client = toAddress(row.client);

  if (!client) return null;
  const responses = row.responses.flatMap((response) => toResponse(response) ?? []);

  return {
    client,
    index: row.index,
    value: row.value,
    revoked: row.revoked,
    ...(row.tag1 ? { tag1: row.tag1 } : {}),
    ...(row.tag2 ? { tag2: row.tag2 } : {}),
    ...(row.endpoint ? { endpoint: row.endpoint } : {}),
    ...(row.createdAt !== null ? { createdAt: row.createdAt } : {}),
    ...(row.feedbackURI ? { feedbackURI: row.feedbackURI } : {}),
    ...(row.txHash ? { txHash: row.txHash as `0x${string}` } : {}),
    ...(responses.length ? { responses } : {}),
  };
}

type IndexedDetail = {
  agent: AgentDetail;
  tagScales: Record<string, TagScale>;
  report?: AgentReputationResponse;
};

/** Maps the owned detail payload onto the shape the explorer tabs already use. */
export function indexToAgent(detail: AgentDetailResponse): IndexedDetail {
  const feedback = detail.feedback.flatMap((row) => toFeedback(row) ?? []);

  return {
    agent: {
      chainId: detail.chainId,
      tokenId: BigInt(detail.tokenId),
      owner: toAddress(detail.owner),
      agentWallet: toAddress(detail.agentWallet),
      agentURI: detail.agentUri,
      reputation: null,
      feedback,
      totalFeedback: detail.feedbackCount,
      ...(detail.registeredAt !== null ? { createdAt: detail.registeredAt } : {}),
    },
    tagScales: detail.tagScales,
  };
}
