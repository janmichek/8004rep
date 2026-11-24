import createClient from 'openapi-fetch';
import { z } from 'zod';
import { agentPageSchema, networkSchema, type Agent, type AgentPage } from '@shared/schemas';
import type { ScanAgent, ScanAgentPage } from '../lib/explorer';
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
function toScanAgent(agent: Agent): ScanAgent {
  const scanAgent: ScanAgent = {
    chainId: agent.chainId,
    tokenId: BigInt(agent.tokenId),
    owner: agent.owner,
    protocols: agent.protocols,
    x402: agent.x402,
    totalScore: agent.totalScore,
    averageScore: agent.averageScore,
    feedbackCount: agent.feedbackCount,
    testnet: agent.testnet,
  };

  if (agent.name) scanAgent.name = agent.name;

  if (agent.description) scanAgent.description = agent.description;

  if (agent.imageUrl) scanAgent.imageUrl = agent.imageUrl;

  if (agent.createdAt !== undefined) scanAgent.createdAt = agent.createdAt;

  return scanAgent;
}

function toScanAgentPage(page: AgentPage): ScanAgentPage {
  return {
    items: page.items.map(toScanAgent),
    total: page.total,
    hasMore: page.hasMore,
  };
}

export async function fetchAgents(query: AgentListQuery = {}): Promise<ScanAgentPage> {
  const { data, response } = await client.GET('/api/agents', { params: { query } });

  if (!response.ok) throw requestFailed(response);

  return toScanAgentPage(agentPageSchema.parse(data));
}

export async function fetchNetworks() {
  const { data, response } = await client.GET('/api/networks');

  if (!response.ok) throw requestFailed(response);

  return z.array(networkSchema).parse(data);
}
