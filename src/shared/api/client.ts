import createClient from 'openapi-fetch';
import { z } from 'zod';
import {
  agentDetailResponseSchema,
  agentPageSchema,
  agentReputationResponseSchema,
  networkSchema,
  networkStatsSchema,
  reputationSpecSchema,
  type Agent,
  type AgentDetailResponse,
  type AgentPage,
  type AgentReputationResponse,
  type AgentsQuery,
  type Network,
  type NetworkStats,
  type ReputationSpec,
} from '@shared/schemas';
import type { IndexedAgent, IndexedAgentPage } from '../lib/explorer/data/indexed';
import type { operations, paths } from './schema';

// Paths come from the generated OpenAPI types. Response bodies are still parsed
// with the shared Zod schemas, so a payload that doesn't match the contract throws.
// fetch is read at call time so Vitest's stubGlobal replaces it after import.
const client = createClient<paths>({
  baseUrl: '',
  fetch: (input: Request) => globalThis.fetch(input),
});

/** The generated query type; it omits the `| undefined` that Zod's inference adds. */
export type AgentListQuery = NonNullable<operations['listAgents']['parameters']['query']>;

function requestFailed(response: Response): Error {
  return new Error(`Request failed: ${response.status}`);
}

/** The wire keeps `tokenId` a string; rows in the explorer compare it as a bigint. */
function toIndexedAgent(agent: Agent): IndexedAgent {
  const indexed: IndexedAgent = {
    chainId: agent.chainId,
    tokenId: BigInt(agent.tokenId),
    owner: agent.owner,
    protocols: agent.protocols,
    x402: agent.x402,
    score: agent.score,
    ciLow: agent.ciLow,
    ciHigh: agent.ciHigh,
    confidence: agent.confidence,
    unrated: agent.unrated,
    rawAverage: agent.rawAverage,
    ratedRows: agent.ratedRows,
    uniqueWallets: agent.uniqueWallets,
    feedbackCount: agent.feedbackCount,
    formulaVersion: agent.formulaVersion,
    testnet: agent.testnet,
  };

  if (agent.name) indexed.name = agent.name;

  if (agent.description) indexed.description = agent.description;

  if (agent.imageUrl) indexed.imageUrl = agent.imageUrl;

  if (agent.createdAt !== undefined) indexed.createdAt = agent.createdAt;

  return indexed;
}

function toIndexedAgentPage(page: AgentPage): IndexedAgentPage {
  return {
    items: page.items.map(toIndexedAgent),
    total: page.total,
    hasMore: page.hasMore,
  };
}

export async function fetchAgents(query: AgentListQuery = {}): Promise<IndexedAgentPage> {
  const { data, response } = await client.GET('/api/agents', { params: { query } });

  if (!response.ok) throw requestFailed(response);

  return toIndexedAgentPage(agentPageSchema.parse(data));
}

export async function fetchNetworks(): Promise<Network[]> {
  const { data, response } = await client.GET('/api/networks');

  if (!response.ok) throw requestFailed(response);

  return z.array(networkSchema).parse(data);
}

export async function fetchAgentDetail(
  chainId: number,
  tokenId: string
): Promise<AgentDetailResponse> {
  const { data, response } = await client.GET('/api/agents/{chainId}/{tokenId}', {
    params: { path: { chainId: String(chainId), tokenId } },
  });

  if (!response.ok) throw requestFailed(response);

  return agentDetailResponseSchema.parse(data);
}

export async function fetchAgentReputation(
  chainId: number,
  tokenId: string
): Promise<AgentReputationResponse> {
  const { data, response } = await client.GET('/api/agents/{chainId}/{tokenId}/reputation', {
    params: { path: { chainId: String(chainId), tokenId } },
  });

  if (!response.ok) throw requestFailed(response);

  return agentReputationResponseSchema.parse(data);
}

export async function fetchNetworkStats(chainId: number): Promise<NetworkStats> {
  const { data, response } = await client.GET('/api/networks/{chainId}/stats', {
    params: { path: { chainId: String(chainId) } },
  });

  if (!response.ok) throw requestFailed(response);

  return networkStatsSchema.parse(data);
}

export async function fetchReputationSpec(): Promise<ReputationSpec> {
  const { data, response } = await client.GET('/api/reputation/spec');

  if (!response.ok) throw requestFailed(response);

  return reputationSpecSchema.parse(data);
}

export type { AgentsQuery };
