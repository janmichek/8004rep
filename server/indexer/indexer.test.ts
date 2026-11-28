import { describe, expect, it } from 'vitest';
import {
  encodeAbiParameters,
  encodeEventTopics,
  pad,
  parseAbiItem,
  type AbiEvent,
  type Hex,
} from 'viem';
import { catalogChain, type ChainRecord } from '../../shared/chains';
import { identityEventByName, reputationEventByName } from '../../shared/erc8004Abi';
import { decodeErc8004Log, decodeWalletMetadata } from './eventDecoder';
import {
  backoffMs,
  chunkLength,
  createChunkState,
  MIN_CHUNK,
  onChunkSuccess,
  onRangeError,
  onTransientError,
  rpcFailure,
} from './chunker';
import { rewindIfNeeded, startCursor } from './reorg';
import { syncChain } from './syncChain';
import type { ApplyChunk, ChainRpc, Cursor, CursorWrite, IndexerStore, RawLog } from './types';

const CLIENT: Hex = '0x1111111111111111111111111111111111111111';
const OWNER: Hex = '0x2222222222222222222222222222222222222222';
const HASH: Hex = `0x${'ab'.repeat(32)}`;

function chainOf(chainId: number): ChainRecord {
  const chain = catalogChain(chainId);

  if (!chain) throw new Error(`missing chain ${chainId}`);

  return chain;
}

type EventArg = string | number | bigint | boolean;

type EventArgs = { [key: string]: EventArg };

function topicValues(topics: ReturnType<typeof encodeEventTopics>): Hex[] {
  const out: Hex[] = [];

  for (const topic of topics) {
    if (Array.isArray(topic)) out.push(...topic);
    else if (topic) out.push(topic);
  }

  return out;
}

function eventLog(event: AbiEvent, args: EventArgs, data: Hex): RawLog {
  const topics = topicValues(encodeEventTopics({ abi: [event], args }));

  return {
    data,
    topics,
    blockNumber: 10n,
    logIndex: 2,
    transactionHash: HASH,
  };
}

function transferLog(): RawLog {
  return eventLog(
    identityEventByName.Transfer,
    { from: '0x0000000000000000000000000000000000000000', to: OWNER, tokenId: 7n },
    '0x'
  );
}

function registeredLog(): RawLog {
  return eventLog(
    identityEventByName.Registered,
    { agentId: 7n, owner: OWNER },
    encodeAbiParameters([{ type: 'string' }], ['ipfs://cid/agent.json'])
  );
}

function uriLog(): RawLog {
  return eventLog(
    identityEventByName.URIUpdated,
    { agentId: 7n, updatedBy: OWNER },
    encodeAbiParameters([{ type: 'string' }], ['https://agent.example/new.json'])
  );
}

function metadataLog(value: Hex): RawLog {
  return eventLog(
    identityEventByName.MetadataSet,
    { agentId: 7n, indexedMetadataKey: 'agentWallet' },
    encodeAbiParameters([{ type: 'string' }, { type: 'bytes' }], ['agentWallet', value])
  );
}

function feedbackLog(): RawLog {
  return eventLog(
    reputationEventByName.NewFeedback,
    { agentId: 7n, clientAddress: CLIENT, indexedTag1: 'starred' },
    encodeAbiParameters(
      [
        { type: 'uint64' },
        { type: 'int128' },
        { type: 'uint8' },
        { type: 'string' },
        { type: 'string' },
        { type: 'string' },
        { type: 'string' },
        { type: 'bytes32' },
      ],
      [3n, 100n, 0, 'Starred', '', 'https://endpoint.example', 'data:,{}', HASH]
    )
  );
}

function revokedLog(): RawLog {
  return eventLog(
    reputationEventByName.FeedbackRevoked,
    { agentId: 7n, clientAddress: CLIENT, feedbackIndex: 3n },
    '0x'
  );
}

function responseLog(): RawLog {
  return eventLog(
    reputationEventByName.ResponseAppended,
    { agentId: 7n, clientAddress: CLIENT, responder: OWNER },
    encodeAbiParameters(
      [{ type: 'uint64' }, { type: 'string' }, { type: 'bytes32' }],
      [3n, 'https://reply.example', HASH]
    )
  );
}

describe('eventDecoder', () => {
  it('decodes every registry event', () => {
    const transfer = decodeErc8004Log(transferLog(), 100n);
    expect(transfer).toMatchObject({ kind: 'transfer', tokenId: 7n, to: OWNER });

    const registered = decodeErc8004Log(registeredLog(), 100n);
    expect(registered).toMatchObject({ kind: 'registered', agentUri: 'ipfs://cid/agent.json' });

    const uri = decodeErc8004Log(uriLog(), 100n);
    expect(uri).toMatchObject({ kind: 'uri-updated', agentUri: 'https://agent.example/new.json' });

    const metadata = decodeErc8004Log(metadataLog(pad(OWNER, { size: 32 })), 100n);
    expect(metadata).toMatchObject({ kind: 'metadata-set', wallet: OWNER.toLowerCase() });

    const feedback = decodeErc8004Log(feedbackLog(), 100n);
    expect(feedback).toMatchObject({
      kind: 'feedback',
      valueRaw: '100',
      valueScaled: 100,
      tagKey: 'starred',
      feedbackIndex: 3n,
    });

    const revoked = decodeErc8004Log(revokedLog(), 100n);
    expect(revoked).toMatchObject({ kind: 'feedback-revoked', feedbackIndex: 3n });

    const response = decodeErc8004Log(responseLog(), 100n);
    expect(response).toMatchObject({ kind: 'response-appended', responder: OWNER.toLowerCase() });
  });

  it('ignores unrelated or malformed logs', () => {
    expect(decodeErc8004Log({ data: '0x', topics: ['0xdeadbeef'] }, 0n)).toBeNull();
    expect(decodeErc8004Log({ data: '0x', topics: [] }, 0n)).toBeNull();

    const approval = eventLog(
      parseAbiItem('event Approval(address indexed owner, address indexed spender, uint256 value)'),
      { owner: OWNER, spender: CLIENT, value: 1n },
      encodeAbiParameters([{ type: 'uint256' }], [1n])
    );

    expect(decodeErc8004Log(approval, 0n)).toBeNull();
  });

  it('decodes wallet metadata from 20-byte and 32-byte values', () => {
    expect(decodeWalletMetadata(OWNER)).toBe(OWNER.toLowerCase());
    expect(decodeWalletMetadata(pad(OWNER, { size: 32 }))).toBe(OWNER.toLowerCase());
    expect(decodeWalletMetadata('0x')).toBeNull();
    expect(decodeWalletMetadata('0x1234')).toBeNull();
    expect(decodeWalletMetadata(`0x${'00'.repeat(32)}`)).toBeNull();
  });

  it('does not decode a wallet for other metadata keys', () => {
    const log = eventLog(
      identityEventByName.MetadataSet,
      { agentId: 7n, indexedMetadataKey: 'name' },
      encodeAbiParameters([{ type: 'string' }, { type: 'bytes' }], ['name', OWNER])
    );

    expect(decodeErc8004Log(log, 0n)).toMatchObject({ kind: 'metadata-set', wallet: null });
  });
});

describe('chunker', () => {
  it('clamps the window and walks the safe head', () => {
    const state = createChunkState(10n);
    expect(state.window).toBe(MIN_CHUNK);
    expect(chunkLength(state, 0n, 10n)).toBe(11n);

    const big = createChunkState(1000n);
    expect(chunkLength(big, 0n, 500n)).toBe(501n);
    expect(chunkLength(big, 600n, 500n)).toBe(0n);
  });

  it('ramps after three clean chunks', () => {
    let state = createChunkState(1000n);
    state = onChunkSuccess(onChunkSuccess(state));
    state = onChunkSuccess(state);
    expect(state.window).toBe(1000n);
  });

  it('halves on range errors and floors at MIN_CHUNK', () => {
    let state = createChunkState(1000n);
    state = onRangeError(state);
    expect(state.window).toBe(500n);
    state = onRangeError(state);
    state = onRangeError(state);
    state = onRangeError(state);
    state = onRangeError(state);
    expect(state.window).toBe(MIN_CHUNK);
    expect(onTransientError(state).clean).toBe(0);
  });

  it('backs off exponentially with jitter', () => {
    expect(backoffMs(0, () => 1)).toBe(500);
    expect(backoffMs(10, () => 1)).toBe(30_000);
  });

  it('classifies RPC failures', () => {
    expect(rpcFailure({ code: -32_005, message: 'too wide' }).kind).toBe('range');
    expect(rpcFailure({ status: 413, message: 'too large' }).kind).toBe('range');
    expect(rpcFailure({ status: 429, message: 'slow down' }).kind).toBe('transient');
    expect(rpcFailure('query returned more than 10000 results').kind).toBe('range');
    expect(rpcFailure('rate limit exceeded').kind).toBe('transient');
    expect(rpcFailure(new Error('boom'))).toMatchObject({ kind: 'fatal', message: 'boom' });
    expect(rpcFailure(42).kind).toBe('fatal');
  });
});

type FakeStore = IndexerStore & {
  chunks: ApplyChunk[];
  cursorWrites: CursorWrite[];
  unwinds: { chainId: number; aboveBlock: bigint }[];
  cursor: Cursor | null;
};

function fakeStore(initialCursor: Cursor | null = null): FakeStore {
  const store: FakeStore = {
    chunks: [],
    cursorWrites: [],
    unwinds: [],
    cursor: initialCursor,
    async getCursor() {
      return store.cursor;
    },
    async applyChunk(chunk) {
      store.chunks.push(chunk);
      store.cursor = {
        chainId: chunk.cursor.chainId,
        lastIndexedBlock: chunk.cursor.block,
        lastIndexedHash: chunk.cursor.hash,
        headBlock: chunk.cursor.headBlock,
        status: chunk.cursor.status,
        lastError: chunk.cursor.error,
      };
    },
    async writeCursor(write) {
      store.cursorWrites.push(write);
    },
    async unwind(chainId, aboveBlock, cursorWrite) {
      store.unwinds.push({ chainId, aboveBlock });
      store.cursorWrites.push(cursorWrite);
    },
  };

  return store;
}

function fakeRpc(overrides: Partial<ChainRpc> = {}): ChainRpc {
  return {
    async getBlockNumber() {
      return 1000n;
    },
    async getBlock(blockNumber) {
      return {
        number: blockNumber,
        hash: `0x${blockNumber.toString(16).padStart(8, '0')}`,
        timestamp: blockNumber,
      };
    },
    async getLogs() {
      return [transferLog(), { ...transferLog(), blockNumber: 11n, logIndex: 0 }];
    },
    ...overrides,
  };
}

describe('reorg', () => {
  it('starts before the first block', () => {
    const chain = chainOf(42161);
    const cursor = startCursor(chain, null);
    expect(cursor.lastIndexedBlock).toBe(chain.startBlock - 1n);
  });

  it('keeps the cursor when the hash matches', async () => {
    const chain = chainOf(42161);
    const store = fakeStore();
    const block = await fakeRpc().getBlock(500n);

    const result = await rewindIfNeeded({
      chain,
      cursor: {
        chainId: chain.chainId,
        lastIndexedBlock: 500n,
        lastIndexedHash: block?.hash ?? null,
        headBlock: null,
        status: 'ok',
        lastError: null,
      },
      rpc: fakeRpc(),
      store,
    });

    expect(result).toEqual({ fromBlock: 501n, rewound: false });
  });

  it('rewinds on a hash mismatch', async () => {
    const chain = chainOf(8453);
    const store = fakeStore();

    const result = await rewindIfNeeded({
      chain,
      cursor: {
        chainId: chain.chainId,
        lastIndexedBlock: 1000n,
        lastIndexedHash: '0xwrong',
        headBlock: null,
        status: 'ok',
        lastError: null,
      },
      rpc: fakeRpc(),
      store,
    });

    expect(result).toEqual({ fromBlock: 937n, rewound: true });
    expect(store.unwinds[0]?.aboveBlock).toBe(936n);
  });

  it('floors the rewind at the chain start block', async () => {
    const chain = chainOf(84532);
    const store = fakeStore();

    const result = await rewindIfNeeded({
      chain,
      cursor: {
        chainId: chain.chainId,
        lastIndexedBlock: chain.startBlock + 10n,
        lastIndexedHash: '0xwrong',
        headBlock: null,
        status: 'ok',
        lastError: null,
      },
      rpc: fakeRpc(),
      store,
    });

    expect(result.fromBlock).toBe(chain.startBlock);
  });
});

describe('syncChain', () => {
  it('applies chunks and writes a final cursor', async () => {
    const chain = chainOf(8453);
    const store = fakeStore();

    const result = await syncChain({
      chain,
      rpc: fakeRpc(),
      store,
      sleep: async () => undefined,
    });

    expect(result.safeHead).toBe(990n);
    expect(result.chunks).toBeGreaterThan(0);
    expect(store.chunks.length).toBeGreaterThan(0);
    expect(store.cursor?.status).toBe('ok');
  });

  it('halves the window on a range error', async () => {
    const chain = chainOf(8453);
    const store = fakeStore();
    let calls = 0;

    const rpc = fakeRpc({
      async getLogs({ fromBlock, toBlock }) {
        calls++;

        if (calls === 1) throw new Error('query returned more than 10000 results');

        return fromBlock === 10n && toBlock === 10n ? [transferLog()] : [];
      },
    });

    const result = await syncChain({ chain, rpc, store, sleep: async () => undefined });
    expect(result.chunks).toBeGreaterThan(0);
  });

  it('retries transient failures', async () => {
    const chain = chainOf(8453);
    const store = fakeStore();
    let failures = 1;

    const rpc = fakeRpc({
      async getLogs({ fromBlock, toBlock }) {
        if (failures > 0) {
          failures--;
          throw new Error('rate limit');
        }

        return fromBlock === 10n && toBlock === 10n ? [transferLog()] : [];
      },
    });

    await syncChain({ chain, rpc, store, random: () => 1, sleep: async () => undefined });
    expect(failures).toBe(0);
  });

  it('retries with the default sleep', async () => {
    const chain = chainOf(8453);
    const store = fakeStore();
    let failures = 1;

    const rpc = fakeRpc({
      async getLogs() {
        if (failures > 0) {
          failures--;
          throw new Error('timeout');
        }

        return [transferLog()];
      },
    });

    await syncChain({ chain, rpc, store, random: () => 0, maxRetries: 1 });
    expect(failures).toBe(0);
  });

  it('marks the cursor errored on a fatal failure', async () => {
    const chain = chainOf(8453);
    const store = fakeStore();

    const rpc = fakeRpc({
      async getLogs() {
        throw new Error('boom');
      },
    });

    await expect(syncChain({ chain, rpc, store })).rejects.toThrow('boom');
    expect(store.cursorWrites.at(-1)?.status).toBe('error');
  });

  it('continues after a reorg rewind', async () => {
    const chain = chainOf(8453);

    const store = fakeStore({
      chainId: chain.chainId,
      lastIndexedBlock: 500n,
      lastIndexedHash: '0xwrong',
      headBlock: 500n,
      status: 'ok',
      lastError: null,
    });

    const result = await syncChain({
      chain,
      rpc: fakeRpc(),
      store,
      sleep: async () => undefined,
    });

    expect(result.rewound).toBe(true);
    expect(store.unwinds.length).toBe(1);
  });

  it('does nothing when the safe head is behind the cursor', async () => {
    const chain = chainOf(8453);

    const store = fakeStore({
      chainId: chain.chainId,
      lastIndexedBlock: 2000n,
      lastIndexedHash: '0x000007d0',
      headBlock: 1000n,
      status: 'ok',
      lastError: null,
    });

    const result = await syncChain({ chain, rpc: fakeRpc(), store });
    expect(result.chunks).toBe(0);
    expect(result.indexedTo).toBe(2000n);
  });
});
