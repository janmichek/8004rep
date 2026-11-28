import { describe, expect, it } from 'vitest';
import type { ParsedRegistration } from '../../shared/metadata/parseRegistration';
import {
  fetchRegistration,
  IPFS_GATEWAYS,
  RETRY_MINUTES,
  runMetadataBatch,
  type MetadataStore,
  type PendingMetadata,
} from './metadataWorker';

const BODY = JSON.stringify({ name: 'Atlas', services: [] });

type Saved = { agent: PendingMetadata; parsed: ParsedRegistration };

type Failed = { agent: PendingMetadata; error: string; retryAt: number };

function fakeStore(pendingAgents: PendingMetadata[]): MetadataStore & {
  saved: Saved[];
  failed: Failed[];
} {
  const saved: Saved[] = [];
  const failed: Failed[] = [];

  const store = {
    saved,
    failed,
    async pendingMetadata() {
      return pendingAgents;
    },
    async saveMetadata(agent: PendingMetadata, parsed: ParsedRegistration) {
      store.saved.push({ agent, parsed });
    },
    async saveMetadataError(agent: PendingMetadata, error: string, retryAt: number) {
      store.failed.push({ agent, error, retryAt });
    },
  };

  return store;
}

function pending(agentUri: string, attempts = 0): PendingMetadata {
  return { chainId: 8453, tokenId: '7', agentUri, attempts };
}

describe('fetchRegistration', () => {
  it('decodes data URIs locally', async () => {
    const relayed: string[] = [];

    const parsed = await fetchRegistration(`data:application/json,${encodeURIComponent(BODY)}`, {
      relay: async (url) => {
        relayed.push(url);

        return { status: 200, body: BODY };
      },
    });

    expect(parsed.name).toBe('Atlas');
    expect(relayed).toEqual([]);
  });

  it('reads https through the relay', async () => {
    const parsed = await fetchRegistration('https://agent.example/agent.json', {
      relay: async () => ({ status: 200, body: BODY }),
    });

    expect(parsed.name).toBe('Atlas');
  });

  it('blocks private hosts before the relay', async () => {
    let called = false;
    await expect(
      fetchRegistration('https://127.0.0.1/agent.json', {
        relay: async () => {
          called = true;

          return { status: 200, body: BODY };
        },
      })
    ).rejects.toThrow('blocked url');
    expect(called).toBe(false);
  });

  it('rotates ipfs gateways', async () => {
    const tried: string[] = [];

    const parsed = await fetchRegistration('ipfs://cid/agent.json', {
      ipfsGateways: ['https://a.example/ipfs/', 'https://b.example/ipfs/'],
      relay: async (url) => {
        tried.push(url);

        if (url.startsWith('https://a.')) throw new Error('502');

        return { status: 200, body: BODY };
      },
    });

    expect(parsed.name).toBe('Atlas');
    expect(tried).toEqual([
      'https://a.example/ipfs/cid/agent.json',
      'https://b.example/ipfs/cid/agent.json',
    ]);
  });

  it('fails when every gateway is down', async () => {
    await expect(
      fetchRegistration('ipfs://cid/agent.json', {
        ipfsGateways: ['https://a.example/ipfs/'],
        relay: async () => {
          throw 'plain 502';
        },
      })
    ).rejects.toThrow('plain 502');
  });

  it('rotates past a gateway that returns a non-registration body', async () => {
    await expect(
      fetchRegistration('ipfs://cid/agent.json', {
        ipfsGateways: ['https://a.example/ipfs/'],
        relay: async () => ({ status: 200, body: '[]' }),
      })
    ).rejects.toThrow('not a registration file');
  });

  it('uses the default gateway list', async () => {
    const parsed = await fetchRegistration('ipfs://cid/agent.json', {
      relay: async (url) => ({ status: 200, body: url.startsWith(IPFS_GATEWAYS[0]) ? BODY : '[]' }),
    });

    expect(parsed.name).toBe('Atlas');
  });

  it('rejects non-registration and unsupported payloads', async () => {
    await expect(
      fetchRegistration('https://agent.example/agent.json', {
        relay: async () => ({ status: 200, body: '[]' }),
      })
    ).rejects.toThrow('not a registration file');
    await expect(
      fetchRegistration('ftp://agent.example/agent.json', {
        relay: async () => ({ status: 200, body: BODY }),
      })
    ).rejects.toThrow('unsupported URI scheme');
    await expect(
      fetchRegistration('data:text/plain,hello', {
        relay: async () => ({ status: 200, body: BODY }),
      })
    ).rejects.toThrow('not a registration file');
  });

  it('rejects a non-200 relay response', async () => {
    await expect(
      fetchRegistration('https://agent.example/agent.json', {
        relay: async () => ({ status: 502, body: 'nope' }),
      })
    ).rejects.toThrow('metadata answered 502');
  });
});

describe('runMetadataBatch', () => {
  it('saves successful metadata and backs off failures', async () => {
    const store = fakeStore([
      pending(`data:application/json,${encodeURIComponent(BODY)}`, 0),
      pending('https://127.0.0.1/agent.json', 2),
    ]);

    const result = await runMetadataBatch({
      store,
      now: 1_000_000,
      relay: async () => ({ status: 200, body: BODY }),
    });

    expect(result).toEqual({ pending: 2, saved: 1, failed: 1 });
    expect(store.saved[0]?.parsed.name).toBe('Atlas');
    expect(store.failed[0]?.retryAt).toBe(1_000_000 + RETRY_MINUTES[2] * 60);
  });

  it('uses the default relay and gateway list', async () => {
    const store = fakeStore([]);
    await runMetadataBatch({ store, now: 0 });
    expect(IPFS_GATEWAYS.length).toBeGreaterThan(1);
  });

  it('passes an explicit gateway list to the fetch step', async () => {
    const store = fakeStore([pending('ipfs://cid/agent.json')]);

    const result = await runMetadataBatch({
      store,
      now: 0,
      ipfsGateways: ['https://only.example/ipfs/'],
      relay: async () => ({ status: 200, body: BODY }),
    });

    expect(result.saved).toBe(1);
  });
});
