import type { ChainRecord } from '../../shared/chains';
import type { ChainRpc, Cursor, IndexerStore } from './types';

/** How far back a hash mismatch rewinds; deep enough for every supported L1 finality. */
const REORG_DEPTH = 64n;

export type ReorgResult = { fromBlock: bigint; hash: string | null; rewound: boolean };

export function startCursor(chain: ChainRecord, stored: Cursor | null): Cursor {
  if (stored) return stored;

  return {
    chainId: chain.chainId,
    lastIndexedBlock: chain.startBlock - 1n,
    lastIndexedHash: null,
    headBlock: null,
    status: 'idle',
    lastError: null,
  };
}

/**
 * Verifies that the last indexed block is still canonical. A hash mismatch
 * deletes everything above the rewind point before the loop re-reads it.
 */
function unchanged(cursor: Cursor): ReorgResult {
  return {
    fromBlock: cursor.lastIndexedBlock + 1n,
    hash: cursor.lastIndexedHash,
    rewound: false,
  };
}

function rewindPoint(chain: ChainRecord, cursor: Cursor): bigint {
  const deepest = chain.startBlock - 1n;
  const candidate = cursor.lastIndexedBlock - REORG_DEPTH;

  return candidate < deepest ? deepest : candidate;
}

export async function rewindIfNeeded(args: {
  chain: ChainRecord;
  cursor: Cursor;
  rpc: ChainRpc;
  store: IndexerStore;
}): Promise<ReorgResult> {
  const { chain, cursor, rpc, store } = args;

  if (cursor.lastIndexedBlock < chain.startBlock || cursor.lastIndexedHash === null) {
    return unchanged(cursor);
  }

  const canonical = await rpc.getBlock(cursor.lastIndexedBlock);

  if (canonical === null) throw new Error('deferred reorg check: block unavailable');

  if (canonical.hash === cursor.lastIndexedHash) return unchanged(cursor);

  const rewindTo = rewindPoint(chain, cursor);
  const block = rewindTo >= 0n ? await rpc.getBlock(rewindTo) : null;

  await store.unwind(chain.chainId, rewindTo, {
    chainId: chain.chainId,
    block: rewindTo,
    hash: block?.hash ?? null,
    headBlock: null,
    status: 'syncing',
    error: null,
  });

  return { fromBlock: rewindTo + 1n, hash: block?.hash ?? null, rewound: true };
}
