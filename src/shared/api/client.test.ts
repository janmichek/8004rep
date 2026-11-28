import { afterEach, expect, test, vi } from 'vitest';
import { REP_SPEC, buildReputationReport } from '@shared/reputation';
import { reputationSpecSchema } from '@shared/schemas';
import {
  fetchAgentDetail,
  fetchAgentReputation,
  fetchAgents,
  fetchNetworks,
  fetchNetworkStats,
  fetchReputationSpec,
} from './client';

afterEach(() => {
  vi.unstubAllGlobals();
});

const agent = {
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
};

const network = {
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
};

const detail = {
  chainId: 8453,
  tokenId: '42',
  name: 'Atlas Broker',
  description: null,
  imageUrl: null,
  owner: null,
  agentWallet: null,
  agentUri: null,
  active: null,
  x402: false,
  protocols: [],
  supportedTrust: [],
  services: [],
  version: null,
  registeredAt: 1_736_154_840,
  feedbackCount: 0,
  testnet: false,
  tagScales: {},
  feedback: [],
};

function reputation() {
  const report = buildReputationReport([], { now: 1_700_000_000 });

  return {
    chainId: 8453,
    tokenId: '42',
    formulaVersion: 'rep-1.0',
    computedAt: 1_700_000_000,
    contentHash: `0x${'ab'.repeat(32)}`,
    tagScales: {},
    report: {
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
    },
  };
}

test('fetchAgents throws when the response is not ok', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(null, { status: 503 }))
  );

  await expect(fetchAgents()).rejects.toThrow('Request failed: 503');
});

test('fetchAgents forwards the sort and maps the token id to a bigint', async () => {
  const page = { items: [agent], total: 1, hasMore: false };

  const fetchMock = vi.fn(async (request: Request) => {
    const url = new URL(request.url);

    expect(url.pathname).toBe('/api/agents');
    expect(url.searchParams.get('sort')).toBe('score');
    expect(url.searchParams.get('order')).toBe('asc');
    expect(url.searchParams.get('page')).toBe('1');
    expect(url.searchParams.get('pageSize')).toBe('10');
    expect(url.searchParams.get('chain')).toBe('8453');
    expect(url.searchParams.get('q')).toBe('atlas');
    expect(url.searchParams.get('env')).toBe('mainnet');
    expect(url.searchParams.get('ratedOnly')).toBe('true');

    return Response.json(page);
  });

  vi.stubGlobal('fetch', fetchMock);

  const result = await fetchAgents({
    q: 'atlas',
    chain: 8453,
    env: 'mainnet',
    sort: 'score',
    order: 'asc',
    page: 1,
    pageSize: 10,
    ratedOnly: true,
  });

  expect(result.items[0]).toEqual({ ...agent, owner: agent.owner, tokenId: 42n });
  expect(fetchMock).toHaveBeenCalledOnce();
});

test('fetchNetworks throws when the response is not ok', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(null, { status: 502 }))
  );

  await expect(fetchNetworks()).rejects.toThrow('Request failed: 502');
});

test('fetchNetworks returns parsed networks', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json([network]))
  );

  await expect(fetchNetworks()).resolves.toEqual([network]);
});

test('fetchAgentDetail and fetchAgentReputation call the owned endpoints', async () => {
  const paths: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (request: Request) => {
      const url = new URL(request.url);
      paths.push(url.pathname);

      return url.pathname.endsWith('/reputation')
        ? Response.json(reputation())
        : Response.json(detail);
    })
  );

  await expect(fetchAgentDetail(8453, '42')).resolves.toEqual(detail);
  await expect(fetchAgentReputation(8453, '42')).resolves.toMatchObject({
    formulaVersion: 'rep-1.0',
  });
  expect(paths).toEqual(['/api/agents/8453/42', '/api/agents/8453/42/reputation']);
});

test('fetchAgentDetail throws on a missing agent', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(null, { status: 404 }))
  );

  await expect(fetchAgentDetail(8453, '404')).rejects.toThrow('Request failed: 404');
  await expect(fetchAgentReputation(8453, '404')).rejects.toThrow('Request failed: 404');
});

test('fetchNetworkStats reads the chain totals', async () => {
  const body = {
    chainId: 8453,
    totalAgents: 100,
    ratedAgents: 40,
    totalFeedback: 900,
    feedback30d: 30,
    lastIndexedBlock: 10_000,
    syncedAt: 1_764_000_000,
  };

  vi.stubGlobal(
    'fetch',
    vi.fn(async (request: Request) => {
      expect(new URL(request.url).pathname).toBe('/api/networks/8453/stats');

      return Response.json(body);
    })
  );

  await expect(fetchNetworkStats(8453)).resolves.toEqual(body);
});

test('fetchNetworkStats and fetchReputationSpec surface failures', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(null, { status: 503 }))
  );

  await expect(fetchNetworkStats(8453)).rejects.toThrow('Request failed: 503');
  await expect(fetchReputationSpec()).rejects.toThrow('Request failed: 503');
});

test('fetchReputationSpec reads the published spec', async () => {
  const spec = reputationSpecSchema.parse(REP_SPEC);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (request: Request) => {
      expect(new URL(request.url).pathname).toBe('/api/reputation/spec');

      return Response.json(spec);
    })
  );

  await expect(fetchReputationSpec()).resolves.toEqual(spec);
});
