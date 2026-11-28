import type { ChainRecord } from '../../shared/chains';
import {
  backoffMs,
  chunkLength,
  createChunkState,
  MIN_CHUNK,
  onChunkSuccess,
  onRangeError,
  onTransientError,
  rpcFailure,
  type ChunkState,
} from './chunker';
import { decodeErc8004Log } from './eventDecoder';
import { rewindIfNeeded, startCursor } from './reorg';
import { cachedBlock, type BlockCache } from './blocks';
import type { ChainRpc, IndexerStore, Mutation, RawLog } from './types';

export type SyncOptions = {
  chain: ChainRecord;
  rpc: ChainRpc;
  store: IndexerStore;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  /** Retries for a transient RPC failure before the chain is marked errored. */
  maxRetries?: number;
  log?: (message: string) => void;
};

export type SyncResult = {
  head: bigint;
  safeHead: bigint;
  indexedTo: bigint;
  chunks: number;
  rewound: boolean;
};

function logOrder(left: RawLog, right: RawLog): number {
  const blockDiff = Number((left.blockNumber ?? 0n) - (right.blockNumber ?? 0n));

  if (blockDiff !== 0) return blockDiff;

  return (left.logIndex ?? 0) - (right.logIndex ?? 0);
}

/** Identity and Reputation logs in one ordered batch. */
async function fetchLogs(
  rpc: ChainRpc,
  chain: ChainRecord,
  fromBlock: bigint,
  toBlock: bigint
): Promise<RawLog[]> {
  const [identity, reputation] = await Promise.all([
    rpc.getLogs({ address: [chain.identity], fromBlock, toBlock }),
    rpc.getLogs({ address: [chain.reputation], fromBlock, toBlock }),
  ]);

  return [...identity, ...reputation].toSorted(logOrder);
}

async function decodeLogs(
  logs: readonly RawLog[],
  rpc: ChainRpc,
  cache: BlockCache
): Promise<Mutation[]> {
  const mutations: Mutation[] = [];

  for (const log of logs) {
    const block = await cachedBlock(rpc, cache, log.blockNumber ?? 0n);
    const mutation = decodeErc8004Log(log, block?.timestamp ?? 0n);

    if (mutation) mutations.push(mutation);
  }

  return mutations;
}

type ChunkOutcome = { state: ChunkState; next: bigint; hash: string | null };

async function syncChunk(args: {
  options: SyncOptions;
  from: bigint;
  to: bigint;
  head: bigint;
  state: ChunkState;
  cache: BlockCache;
}): Promise<ChunkOutcome> {
  const { options, from, to, head, state, cache } = args;
  const { chain, rpc, store } = options;
  const logs = await fetchLogs(rpc, chain, from, to);
  const mutations = await decodeLogs(logs, rpc, cache);
  const lastBlock = await cachedBlock(rpc, cache, to);

  if (!lastBlock) throw new Error(`block ${to.toString()} unavailable`);

  await store.applyChunk({
    chainId: chain.chainId,
    mutations,
    cursor: {
      chainId: chain.chainId,
      block: to,
      hash: lastBlock.hash,
      headBlock: head,
      status: 'ok',
      error: null,
    },
  });

  return { state: onChunkSuccess(state), next: to + 1n, hash: lastBlock.hash };
}

type LoopState = {
  from: bigint;
  state: ChunkState;
  chunks: number;
  attempt: number;
  lastHash: string | null;
};

async function syncLoop(args: {
  options: SyncOptions;
  safeHead: bigint;
  head: bigint;
  start: bigint;
  startHash: string | null;
  cache: BlockCache;
}): Promise<LoopState> {
  const { options, safeHead, head, start, startHash, cache } = args;
  const { chain } = options;

  const sleep =
    options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  let current: LoopState = {
    from: start,
    state: createChunkState(chain.logsLogRange ?? chain.logRange),
    chunks: 0,
    attempt: 0,
    lastHash: startHash,
  };

  while (current.from <= safeHead) {
    const length = chunkLength(current.state, current.from, safeHead);
    const to = current.from + length - 1n;

    try {
      const done = await syncChunk({
        options,
        from: current.from,
        to,
        head,
        state: current.state,
        cache,
      });

      current = {
        from: done.next,
        state: done.state,
        chunks: current.chunks + 1,
        attempt: 0,
        lastHash: done.hash,
      };
    } catch (cause) {
      current = await handleFailure({ options, current, cause, sleep });
    }
  }

  return current;
}

async function handleFailure(args: {
  options: SyncOptions;
  current: LoopState;
  cause: unknown;
  sleep: (ms: number) => Promise<void>;
}): Promise<LoopState> {
  const { options, current, sleep } = args;
  const failure = rpcFailure(args.cause);
  const maxRetries = options.maxRetries ?? 5;

  if (failure.kind === 'range' && current.state.window > MIN_CHUNK) {
    options.log?.(`range too large; halving to ${current.state.window / 2n} blocks`);

    return { ...current, state: onRangeError(current.state), attempt: 0 };
  }

  if (failure.kind === 'transient' && current.attempt < maxRetries) {
    const delay = backoffMs(current.attempt, options.random);
    options.log?.(`transient RPC failure; retrying in ${delay}ms`);
    await sleep(delay);

    return { ...current, state: onTransientError(current.state), attempt: current.attempt + 1 };
  }

  await options.store.writeCursor({
    chainId: options.chain.chainId,
    block: current.from - 1n,
    hash: current.lastHash,
    headBlock: null,
    status: 'error',
    error: failure.message,
  });

  throw new Error(`indexer stopped on ${options.chain.slug}: ${failure.message}`);
}

/**
 * Walks `[startBlock, safeHead]` in adaptive chunks, applying each chunk and
 * its cursor atomically. A reorg check runs before the first request.
 */
export async function syncChain(options: SyncOptions): Promise<SyncResult> {
  const { chain, rpc, store } = options;
  const head = await rpc.getBlockNumber();
  const safeHead = head - BigInt(chain.confirmations);
  const stored = await store.getCursor(chain.chainId);
  const cursor = startCursor(chain, stored);
  const reorg = await rewindIfNeeded({ chain, cursor, rpc, store });
  const cache: BlockCache = new Map();

  const result = await syncLoop({
    options,
    safeHead,
    head,
    start: reorg.fromBlock,
    startHash: reorg.hash,
    cache,
  });

  const hasCursor = result.chunks > 0 || result.from - 1n >= chain.startBlock;
  const last = hasCursor ? await cachedBlock(rpc, cache, result.from - 1n) : null;

  if (hasCursor && last) {
    await store.writeCursor({
      chainId: chain.chainId,
      block: result.from - 1n,
      hash: last.hash,
      headBlock: head,
      status: 'ok',
      error: null,
    });
  }

  return {
    head,
    safeHead,
    indexedTo: result.from - 1n,
    chunks: result.chunks,
    rewound: reorg.rewound,
  };
}
