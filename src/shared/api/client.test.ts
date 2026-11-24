import { afterEach, expect, test, vi } from 'vitest';
import { fetchAgents, fetchNetworks } from './client';

afterEach(() => {
  vi.unstubAllGlobals();
});

test('fetchAgents throws when the response is not ok', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(null, { status: 503 }))
  );

  await expect(fetchAgents()).rejects.toThrow('Request failed: 503');
});

test('fetchAgents forwards the sort and maps the token id to a bigint', async () => {
  const page = {
    items: [
      {
        chainId: 8453,
        tokenId: '42',
        name: 'Atlas Broker',
        owner: '0x1111111111111111111111111111111111111111',
        protocols: ['MCP'],
        x402: false,
        totalScore: 72,
        averageScore: 80,
        feedbackCount: 18,
        createdAt: 1_736_154_840,
        testnet: false,
      },
    ],
    total: 1,
    hasMore: false,
  };

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

    return Response.json(page);
  });

  vi.stubGlobal('fetch', fetchMock);

  await expect(
    fetchAgents({
      q: 'atlas',
      chain: 8453,
      env: 'mainnet',
      sort: 'score',
      order: 'asc',
      page: 1,
      pageSize: 10,
    })
  ).resolves.toEqual({
    items: [{ ...page.items[0], tokenId: 42n }],
    total: 1,
    hasMore: false,
  });
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
  const body = [
    {
      code: 'BASE',
      name: 'Base',
      symbol: 'B',
      color: 'blue',
      chainId: 8453,
      testnet: false,
    },
  ];

  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json(body))
  );

  await expect(fetchNetworks()).resolves.toEqual(body);
});
