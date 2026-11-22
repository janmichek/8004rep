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
