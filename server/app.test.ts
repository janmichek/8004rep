import { afterEach, describe, expect, test, vi } from 'vitest';
import { buildReputationReport } from '../shared/reputation';
import {
  agentDetailResponseSchema,
  agentPageSchema,
  agentReputationResponseSchema,
  networkSchema,
  networkStatsSchema,
  reputationSpecSchema,
  type AgentDetailResponse,
  type AgentPage,
  type AgentReputationResponse,
  type Network,
  type NetworkStats,
} from '../shared/schemas';
import { createApp } from './app';
import { createTtlCache } from './cache';
import type { AgentStore } from './db/agentStore';
import type { NetworkStore } from './db/networkStore';

afterEach(() => {
  vi.unstubAllGlobals();
});

const page: AgentPage = agentPageSchema.parse({
  items: [
    {
      chainId: 8453,
      tokenId: '42',
      name: 'Atlas Broker',
      owner: '0x1111111111111111111111111111111111111111',
      protocols: ['MCP'],
      x402: false,
      score: 72,
      ciLow: 64,
      ciHigh: 80,
      confidence: 'medium',
      unrated: false,
      rawAverage: 80,
      ratedRows: 18,
      uniqueWallets: 6,
      feedbackCount: 18,
      formulaVersion: 'rep-1.0',
      createdAt: 1_736_154_840,
      testnet: false,
    },
  ],
  total: 120,
  hasMore: true,
});

const detail: AgentDetailResponse = agentDetailResponseSchema.parse({
  chainId: 8453,
  tokenId: '42',
  name: 'Atlas Broker',
  description: null,
  imageUrl: null,
  owner: '0x1111111111111111111111111111111111111111',
  agentWallet: null,
  agentUri: 'ipfs://cid/agent.json',
  active: true,
  x402: false,
  protocols: ['MCP'],
  supportedTrust: ['reputation'],
  services: [{ name: 'MCP', endpoint: 'https://mcp.example' }],
  version: '1.0.0',
  registeredAt: 1_736_154_840,
  feedbackCount: 0,
  testnet: false,
  tagScales: {},
  feedback: [],
});

const reputation: AgentReputationResponse = agentReputationResponseSchema.parse({
  chainId: 8453,
  tokenId: '42',
  formulaVersion: 'rep-1.0',
  computedAt: 1_700_000_000,
  contentHash: `0x${'ab'.repeat(32)}`,
  tagScales: { starred: { scale: 'five', span: 5 } },
  report: (() => {
    const report = buildReputationReport([], { now: 1_700_000_000 });

    return {
      score: report.score,
      interval: report.interval,
      confidence: report.confidence,
      unrated: report.unrated,
      raw: report.raw,
      rawRatings: report.rawRatings,
      inflation: report.inflation,
      cost: report.cost,
      funnel: report.funnel,
      concentration: report.concentration,
      contributions: report.contributions,
      waterfall: report.waterfall,
      counts: report.counts,
      byKind: report.byKind,
      telemetry: report.telemetry,
      findings: report.findings,
      responsiveness: report.responsiveness,
    };
  })(),
});

const networks: Network[] = [
  networkSchema.parse({
    code: 'BASE',
    name: 'Base',
    shortName: 'Base',
    slug: 'base',
    symbol: 'B',
    color: 'blue',
    chainId: 8453,
    testnet: false,
    lastIndexedBlock: 10_000,
    syncStatus: 'ok',
    syncedAt: 1_764_000_000,
  }),
];

const stats: NetworkStats = networkStatsSchema.parse({
  chainId: 8453,
  totalAgents: 100,
  ratedAgents: 40,
  totalFeedback: 900,
  feedback30d: 30,
  lastIndexedBlock: 10_000,
  syncedAt: 1_764_000_000,
});

function fakeAgentStore(overrides: Partial<AgentStore> = {}): AgentStore {
  return {
    async listAgents() {
      return page;
    },
    async getAgentDetail() {
      return detail;
    },
    async getAgentReputation() {
      return reputation;
    },
    ...overrides,
  };
}

function fakeNetworkStore(overrides: Partial<NetworkStore> = {}): NetworkStore {
  return {
    async listNetworks() {
      return networks;
    },
    async getNetworkStats() {
      return stats;
    },
    ...overrides,
  };
}

function testApp(stores: { agentStore?: AgentStore; networkStore?: NetworkStore } = {}) {
  return createApp({
    agentStore: stores.agentStore ?? fakeAgentStore(),
    networkStore: stores.networkStore ?? fakeNetworkStore(),
  });
}

describe('GET /api/agents', () => {
  test('passes the query to the store and returns the contract page', async () => {
    const listAgents = vi.fn<AgentStore['listAgents']>(async () => page);
    const app = testApp({ agentStore: fakeAgentStore({ listAgents }) });

    const response = await app.request(
      '/api/agents?q=atlas&chain=8453&env=mainnet&sort=score&order=asc&page=1&pageSize=10&ratedOnly=true'
    );

    const body = agentPageSchema.parse(await response.json());

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('stale-while-revalidate');
    expect(body.total).toBe(120);
    expect(listAgents).toHaveBeenCalledWith({
      q: 'atlas',
      chain: 8453,
      env: 'mainnet',
      sort: 'score',
      order: 'asc',
      page: 1,
      pageSize: 10,
      ratedOnly: true,
    });
  });

  test('rejects an invalid sort before calling the store', async () => {
    const listAgents = vi.fn<AgentStore['listAgents']>(async () => page);
    const app = testApp({ agentStore: fakeAgentStore({ listAgents }) });

    const response = await app.request('/api/agents?sort=nope');

    expect(response.status).toBe(400);
    expect(listAgents).not.toHaveBeenCalled();
  });

  test('serves a cached page without calling the store again', async () => {
    const listAgents = vi.fn<AgentStore['listAgents']>(async () => page);

    const app = createApp({
      agentStore: fakeAgentStore({ listAgents }),
      networkStore: fakeNetworkStore(),
      agentCache: createTtlCache<AgentPage>(60_000, 10, () => 0),
    });

    const first = await app.request('/api/agents?order=asc&sort=score');
    const second = await app.request('/api/agents?sort=score&order=asc');

    expect(first.headers.get('cache-control')).toContain('s-maxage=60');
    expect(second.headers.get('cache-control')).toContain('s-maxage=60');
    expect(listAgents).toHaveBeenCalledOnce();
  });

  test('maps a store failure to 503', async () => {
    const app = testApp({
      agentStore: fakeAgentStore({
        async listAgents() {
          throw new Error('db down');
        },
      }),
    });

    const response = await app.request('/api/agents');

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'Agents are unavailable' });
  });
});

describe('GET /api/agents/:chainId/:tokenId', () => {
  test('returns the indexed detail', async () => {
    const app = testApp();
    const response = await app.request('/api/agents/8453/42');

    expect(response.status).toBe(200);
    expect(agentDetailResponseSchema.parse(await response.json()).tokenId).toBe('42');
  });

  test('returns 404 for an unknown agent', async () => {
    const app = testApp({
      agentStore: fakeAgentStore({
        async getAgentDetail() {
          return null;
        },
      }),
    });

    expect((await app.request('/api/agents/8453/999')).status).toBe(404);
  });

  test('returns 400 for a malformed id', async () => {
    const app = testApp();

    expect((await app.request('/api/agents/base/42')).status).toBe(400);
    expect((await app.request('/api/agents/8453/abc')).status).toBe(400);
  });

  test('maps a store failure to 503', async () => {
    const app = testApp({
      agentStore: fakeAgentStore({
        async getAgentDetail() {
          throw new Error('db down');
        },
      }),
    });

    expect((await app.request('/api/agents/8453/42')).status).toBe(503);
  });
});

describe('GET /api/agents/:chainId/:tokenId/reputation', () => {
  test('returns the published rep-1.0 response', async () => {
    const app = testApp();
    const response = await app.request('/api/agents/8453/42/reputation');
    const body = agentReputationResponseSchema.parse(await response.json());

    expect(response.status).toBe(200);
    expect(body.formulaVersion).toBe('rep-1.0');
    expect(body.contentHash).toHaveLength(66);
  });

  test('returns 404, 400 and 503 for the failure modes', async () => {
    const missing = testApp({
      agentStore: fakeAgentStore({
        async getAgentReputation() {
          return null;
        },
      }),
    });

    const failing = testApp({
      agentStore: fakeAgentStore({
        async getAgentReputation() {
          throw new Error('db down');
        },
      }),
    });

    expect((await missing.request('/api/agents/8453/42/reputation')).status).toBe(404);
    expect((await missing.request('/api/agents/x/42/reputation')).status).toBe(400);
    expect((await failing.request('/api/agents/8453/42/reputation')).status).toBe(503);
  });
});

describe('network routes', () => {
  test('lists networks', async () => {
    const response = await testApp().request('/api/networks');
    const body = networkSchema.array().parse(JSON.parse(await response.text()));

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('s-maxage=60');
    expect(body[0]?.slug).toBe('base');
  });

  test('lists network stats', async () => {
    const response = await testApp().request('/api/networks/8453/stats');

    expect(response.status).toBe(200);
    expect(networkStatsSchema.parse(await response.json()).totalFeedback).toBe(900);
  });

  test('maps stats failures to 400, 404 and 503', async () => {
    const missing = testApp({
      networkStore: fakeNetworkStore({
        async getNetworkStats() {
          return null;
        },
      }),
    });

    const failing = testApp({
      networkStore: fakeNetworkStore({
        async getNetworkStats() {
          throw new Error('db down');
        },
      }),
    });

    expect((await missing.request('/api/networks/x/stats')).status).toBe(400);
    expect((await missing.request('/api/networks/8453/stats')).status).toBe(404);
    expect((await failing.request('/api/networks/8453/stats')).status).toBe(503);
  });

  test('maps a network list failure to 503', async () => {
    const app = testApp({
      networkStore: fakeNetworkStore({
        async listNetworks() {
          throw new Error('db down');
        },
      }),
    });

    expect((await app.request('/api/networks')).status).toBe(503);
  });
});

describe('GET /api/reputation/spec', () => {
  test('serves the published formula with a long cache', async () => {
    const response = await testApp().request('/api/reputation/spec');
    const body = reputationSpecSchema.parse(await response.json());

    expect(response.status).toBe(200);
    expect(body.formulaVersion).toBe('rep-1.0');
    expect(body.steps.map((step) => step.id)).toContain('prior');
    expect(response.headers.get('cache-control')).toContain('stale-while-revalidate');
  });
});

describe('without a database', () => {
  test('reports the owned API as unavailable instead of proxying', async () => {
    const previous = process.env['DATABASE_URL'];
    delete process.env['DATABASE_URL'];

    try {
      const app = createApp();

      expect((await app.request('/api/agents')).status).toBe(503);
      expect((await app.request('/api/agents/8453/42')).status).toBe(503);
      expect((await app.request('/api/agents/8453/42/reputation')).status).toBe(503);
      expect((await app.request('/api/networks')).status).toBe(503);
      expect((await app.request('/api/networks/8453/stats')).status).toBe(503);
    } finally {
      if (previous !== undefined) process.env['DATABASE_URL'] = previous;
    }
  });
});

describe('GET /api/fetch-json', () => {
  test('relays a public JSON document', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"ok":true}', { status: 200 }))
    );

    const response = await testApp().request(
      `/api/fetch-json?url=${encodeURIComponent('https://example.com/a.json')}`
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(response.headers.get('cache-control')).toContain('s-maxage');
  });

  test('refuses a blocked host', async () => {
    const response = await testApp().request(
      `/api/fetch-json?url=${encodeURIComponent('https://127.0.0.1/a.json')}`
    );

    expect(response.status).toBe(400);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
});

describe('GET /api/probe', () => {
  test('returns the probe result as JSON', async () => {
    const app = createApp({
      agentStore: fakeAgentStore(),
      networkStore: fakeNetworkStore(),
      probe: async () => ({
        ok: true,
        status: 200,
        latencyMs: 12,
        contentType: 'application/json',
        finalUrl: 'https://example.com',
        checkedAt: 1,
      }),
    });

    const response = await app.request(
      `/api/probe?url=${encodeURIComponent('https://example.com')}`
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, status: 200, latencyMs: 12 });
  });

  test('answers 400 when the URL is blocked', async () => {
    const app = createApp({
      agentStore: fakeAgentStore(),
      networkStore: fakeNetworkStore(),
      probe: async () => ({
        ok: false,
        status: null,
        latencyMs: null,
        contentType: null,
        finalUrl: 'http://127.0.0.1',
        checkedAt: 1,
        error: 'blocked-url',
      }),
    });

    expect((await app.request('/api/probe?url=http://127.0.0.1')).status).toBe(400);
  });
});
