import { afterEach, describe, expect, test, vi } from 'vitest';
import { agentPageSchema, networkSchema } from '../shared/schemas';
import { app } from './app';

afterEach(() => {
  vi.unstubAllGlobals();
});

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
    expect(response.headers.get('cache-control')).toContain('s-maxage');
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
});

describe('GET /api/networks', () => {
  test('returns every network, parsed through the shared schema', async () => {
    const response = await app.request('/api/networks');
    const body = networkSchema.array().parse(JSON.parse(await response.text()));

    expect(response.status).toBe(200);
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
});
