import { afterEach, describe, expect, test, vi } from 'vitest';
import type { AgentPage } from '../shared/schemas';
import { agentPageSchema, networkSchema } from '../shared/schemas';
import { createApp } from './app';
import { createTtlCache } from './cache';
import type { AgentPageFetcher } from './routes/agents';

afterEach(() => {
  vi.unstubAllGlobals();
});

const app = createApp();

const scanAgent = {
  token_id: '42',
  chain_id: 8453,
  owner_address: '0x1111111111111111111111111111111111111111',
  name: 'Atlas Broker',
  supported_protocols: ['MCP'],
  x402_supported: false,
  total_score: 72,
  average_score: 80,
  total_feedbacks: 18,
  is_testnet: false,
  created_at: '2026-11-24T10:00:00Z',
};

const scanPage = {
  success: true,
  data: [scanAgent],
  meta: { pagination: { page: 2, limit: 10, total: 120, hasMore: true } },
};

const emptyPage: AgentPage = agentPageSchema.parse({ items: [], total: 0, hasMore: false });

describe('GET /api/agents', () => {
  test('proxies the query to 8004scan and returns the contract page', async () => {
    const fetchMock = vi.fn(async (input: string) => {
      const url = new URL(input);

      expect(`${url.origin}${url.pathname}`).toBe('https://8004scan.io/api/v1/public/agents');
      expect(url.searchParams.get('page')).toBe('2');
      expect(url.searchParams.get('limit')).toBe('10');
      expect(url.searchParams.get('search')).toBe('atlas');
      expect(url.searchParams.get('chainId')).toBe('8453');
      expect(url.searchParams.get('isTestnet')).toBe('false');
      expect(url.searchParams.get('sortBy')).toBe('total_score');
      expect(url.searchParams.get('sortOrder')).toBe('asc');

      return Response.json(scanPage);
    });

    vi.stubGlobal('fetch', fetchMock);

    const response = await app.request(
      '/api/agents?q=atlas&chain=8453&env=mainnet&sort=score&order=asc&page=1&pageSize=10'
    );

    const body = agentPageSchema.parse(await response.json());

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('stale-while-revalidate');
    expect(body.items[0]?.tokenId).toBe('42');
    expect(body.total).toBe(120);
    expect(body.hasMore).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  test('rejects an invalid sort before calling 8004scan', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await app.request('/api/agents?sort=nope');

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('returns 502 when 8004scan fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 503 }))
    );

    const response = await app.request('/api/agents');

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: '8004scan could not be reached' });
  });

  test('passes an upstream rate limit and Retry-After through', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 429, headers: { 'retry-after': '120' } }))
    );

    const response = await app.request('/api/agents');

    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('120');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ error: '8004scan rate limit reached' });
  });

  test('omits an unusable Retry-After', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(null, {
            status: 429,
            headers: { 'retry-after': 'Wed, 21 Oct 2015 07:28:00 GMT' },
          })
      )
    );

    const response = await app.request('/api/agents');

    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBeNull();
  });

  test('serves a cached page without calling upstream again', async () => {
    const fetchAgentPage = vi.fn<AgentPageFetcher>(async () => emptyPage);

    const cachedApp = createApp({
      fetchAgentPage,
      agentCache: createTtlCache<AgentPage>(60_000, 10, () => 0),
    });

    const first = await cachedApp.request('/api/agents?q=atlas');
    const second = await cachedApp.request('/api/agents?q=atlas');

    expect(first.headers.get('cache-control')).toContain('stale-while-revalidate');
    expect(second.headers.get('cache-control')).toContain('s-maxage=60');
    expect(await second.json()).toEqual(emptyPage);
    expect(fetchAgentPage).toHaveBeenCalledOnce();
  });

  test('shares a cache entry across parameter order', async () => {
    const fetchAgentPage = vi.fn<AgentPageFetcher>(async () => emptyPage);

    const cachedApp = createApp({
      fetchAgentPage,
      agentCache: createTtlCache<AgentPage>(60_000, 10, () => 0),
    });

    await cachedApp.request('/api/agents?sort=score&order=asc');
    await cachedApp.request('/api/agents?order=asc&sort=score');

    expect(fetchAgentPage).toHaveBeenCalledOnce();
  });
});

describe('GET /api/networks', () => {
  test('returns every network, parsed through the shared schema', async () => {
    const response = await app.request('/api/networks');
    const body = networkSchema.array().parse(JSON.parse(await response.text()));

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('s-maxage=86400');
    expect(body.map((network) => network.code)).toContain('BASE');
  });
});

describe('GET /api/fetch-json', () => {
  test('relays a public JSON document', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"ok":true}', { status: 200 }))
    );

    const response = await app.request(
      `/api/fetch-json?url=${encodeURIComponent('https://example.com/a.json')}`
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(response.headers.get('cache-control')).toContain('s-maxage');
    vi.unstubAllGlobals();
  });

  test('refuses a blocked host', async () => {
    const response = await app.request(
      `/api/fetch-json?url=${encodeURIComponent('https://127.0.0.1/a.json')}`
    );

    expect(response.status).toBe(400);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  test('rejects a missing url without fetching', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await app.request('/api/fetch-json');

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('createApp dependencies', () => {
  test('uses injected networks and relay handlers', async () => {
    const injectedApp = createApp({
      networks: [
        { code: 'TEST', name: 'Test', symbol: 'T', color: 'gray', chainId: 999, testnet: true },
      ],
      relayResponse: async () => new Response('relayed', { status: 200 }),
    });

    const networksResponse = await injectedApp.request('/api/networks');
    const relayResponse = await injectedApp.request('/api/fetch-json');

    expect(await networksResponse.json()).toHaveLength(1);
    expect(await relayResponse.text()).toBe('relayed');
  });
});

describe('GET /api/probe', () => {
  test('returns the probe result as JSON', async () => {
    const probeApp = createApp({
      probe: async () => ({
        ok: true,
        status: 200,
        latencyMs: 12,
        contentType: 'application/json',
        finalUrl: 'https://example.com',
        checkedAt: 1,
      }),
    });

    const response = await probeApp.request(
      `/api/probe?url=${encodeURIComponent('https://example.com')}`
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, status: 200, latencyMs: 12 });
  });

  test('answers 400 when the URL is blocked', async () => {
    const probeApp = createApp({
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

    const response = await probeApp.request('/api/probe?url=http://127.0.0.1');

    expect(response.status).toBe(400);
  });
});
