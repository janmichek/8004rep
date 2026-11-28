import { describe, expect, it } from 'vitest';
import type { QueryParam, Sql } from './client';
import { createAgentStore } from './agentStore';
import { createNetworkStore } from './networkStore';

const LIST_ROW = {
  chain_id: 8453,
  token_id: '7',
  name: 'Atlas',
  description: null,
  image_url: null,
  owner: '0x1111111111111111111111111111111111111111',
  protocols: ['MCP'],
  x402: false,
  score: 72,
  ci_low: 64,
  ci_high: 80,
  confidence: 'medium',
  unrated: false,
  raw_average: 80,
  rated_rows: 12,
  unique_wallets: 6,
  feedback_count: 18,
  registered_at: '1736154840',
};

const DETAIL_ROW = {
  chain_id: 8453,
  token_id: '7',
  name: 'Atlas',
  description: null,
  image_url: null,
  owner: '0x1111111111111111111111111111111111111111',
  agent_wallet: '0x3333333333333333333333333333333333333333',
  agent_uri: 'ipfs://cid',
  active: true,
  x402: false,
  protocols: ['MCP'],
  supported_trust: ['reputation'],
  services_json: [{ name: 'MCP', endpoint: 'https://mcp.example' }],
  version: '1.0.0',
  registered_at: '1736154840',
  feedback_count: '1',
};

const FEEDBACK_ROW = {
  chain_id: 8453,
  token_id: '7',
  client_address: '0x2222222222222222222222222222222222222222',
  feedback_index: '0',
  endpoint: 'https://endpoint.example',
  feedback_uri: 'https://file.example',
  value_scaled: 4,
  tag1: 'starred',
  tag2: 'quality',
  revoked: false,
  created_at: '1700000000',
  tx_hash: '0xabc',
};

const RESPONSE_ROW = {
  chain_id: 8453,
  token_id: '7',
  client_address: FEEDBACK_ROW.client_address,
  feedback_index: '0',
  responder: '0x1111111111111111111111111111111111111111',
  response_uri: 'https://reply.example',
  created_at: '1700000100',
  tx_hash: '0xdef',
};

type Call = { query: string; params: readonly QueryParam[] };

type Handler = (query: string, params: readonly QueryParam[]) => object[];

function fakeSql(handler: Handler): Sql & { calls: Call[] } {
  const calls: Call[] = [];

  const db: Sql = {
    async query(query, params = []) {
      calls.push({ query, params });

      return handler(query, params);
    },
    async transaction<T>(run: (tx: Sql) => Promise<T>) {
      return run(db);
    },
    async close() {},
  };

  return Object.assign(db, { calls });
}

const CURSOR = {
  chain_id: 8453,
  last_indexed_block: '10000',
  status: 'ok',
  synced_at: '1764000000',
};

describe('agentStore', () => {
  it('lists a page with exact totals', async () => {
    const db = fakeSql((query) =>
      query.startsWith('SELECT COUNT') ? [{ total: 2 }] : [LIST_ROW, { ...LIST_ROW, token_id: '8' }]
    );

    const result = await createAgentStore(db).listAgents({ page: 0, pageSize: 1 });

    expect(result.total).toBe(2);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.score).toBe(72);
    expect(result.hasMore).toBe(true);
  });

  it('returns an empty page', async () => {
    const db = fakeSql(() => []);
    const result = await createAgentStore(db).listAgents({});

    expect(result).toEqual({ items: [], total: 0, hasMore: false });
  });

  it('reads an indexed detail', async () => {
    const db = fakeSql((query) => {
      if (query.includes('FROM agents a') && query.includes('WHERE a.chain_id'))
        return [DETAIL_ROW];

      if (query.includes('FROM feedbacks')) return [FEEDBACK_ROW];

      if (query.includes('FROM feedback_responses')) return [RESPONSE_ROW];

      if (query.includes('FROM tag_scales'))
        return [{ tag_key: 'starred', scale: 'five', span: 5 }];

      return [];
    });

    const detail = await createAgentStore(db).getAgentDetail(8453, '7');

    expect(detail?.tokenId).toBe('7');
    expect(detail?.tagScales['starred']?.span).toBe(5);
    expect(detail?.feedback[0]?.responses).toHaveLength(1);
  });

  it('returns null for an unknown detail', async () => {
    const db = fakeSql(() => []);
    await expect(createAgentStore(db).getAgentDetail(8453, '404')).resolves.toBeNull();
  });

  it('builds the rep-1.0 response from indexed rows', async () => {
    const db = fakeSql((query) => {
      if (query.includes('SELECT owner, agent_wallet')) return [DETAIL_ROW];

      if (query.includes('FROM feedbacks')) return [FEEDBACK_ROW];

      if (query.includes('FROM feedback_responses')) return [RESPONSE_ROW];

      if (query.includes('FROM tag_scales'))
        return [{ tag_key: 'starred', scale: 'five', span: 5 }];

      return [];
    });

    const result = await createAgentStore(db).getAgentReputation(8453, '7');

    expect(result?.formulaVersion).toBe('rep-1.0');
    expect(result?.contentHash).toHaveLength(64);
    expect(result?.report.counts.rating).toBe(1);
    expect(result?.tagScales['starred']?.scale).toBe('five');
  });

  it('returns null when the agent is not indexed', async () => {
    const db = fakeSql(() => []);
    await expect(createAgentStore(db).getAgentReputation(8453, '404')).resolves.toBeNull();
  });
});

describe('networkStore', () => {
  it('merges every catalog chain with its cursor', async () => {
    const db = fakeSql(() => [CURSOR]);
    const networks = await createNetworkStore(db).listNetworks();
    const base = networks.find((network) => network.chainId === 8453);

    expect(networks).toHaveLength(13);
    expect(base?.lastIndexedBlock).toBe(10_000);
    expect(base?.syncStatus).toBe('ok');
    expect(base?.syncedAt).toBe(1_764_000_000);
    expect(networks.find((network) => network.chainId === 1)?.syncStatus).toBe('idle');
  });

  it('returns nulls for a chain without a cursor', async () => {
    const db = fakeSql(() => []);
    const networks = await createNetworkStore(db).listNetworks();

    expect(networks.every((network) => network.lastIndexedBlock === null)).toBe(true);
    expect(networks.every((network) => network.syncedAt === null)).toBe(true);
  });

  it('reads network totals', async () => {
    const db = fakeSql((query) =>
      query.includes('last_indexed_block')
        ? [{ last_indexed_block: '10000', synced_at: '1764000000' }]
        : [{ total_agents: 100, rated_agents: 40, total_feedback: 900, feedback30d: 30 }]
    );

    const stats = await createNetworkStore(db).getNetworkStats(8453);

    expect(stats).toEqual({
      chainId: 8453,
      totalAgents: 100,
      ratedAgents: 40,
      totalFeedback: 900,
      feedback30d: 30,
      lastIndexedBlock: 10_000,
      syncedAt: 1_764_000_000,
    });
  });

  it('handles an unknown chain and missing rows', async () => {
    const db = fakeSql(() => []);
    const store = createNetworkStore(db);

    await expect(store.getNetworkStats(999_999)).resolves.toBeNull();
    await expect(store.getNetworkStats(8453)).resolves.toBeNull();

    const noCursor = fakeSql((query) =>
      query.includes('last_indexed_block')
        ? []
        : [{ total_agents: 1, rated_agents: 1, total_feedback: 1, feedback30d: 1 }]
    );

    await expect(createNetworkStore(noCursor).getNetworkStats(8453)).resolves.toMatchObject({
      lastIndexedBlock: null,
      syncedAt: null,
    });
  });
});
