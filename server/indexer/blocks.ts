import type { BlockRef, ChainRpc } from './types';

export type BlockCache = Map<bigint, BlockRef | null>;

/** Per-chunk block cache: timestamps and hashes are fetched once per block. */
export async function cachedBlock(
  rpc: ChainRpc,
  cache: BlockCache,
  number: bigint
): Promise<BlockRef | null> {
  const cached = cache.get(number);

  if (cached !== undefined) return cached;

  const block = await rpc.getBlock(number);
  cache.set(number, block);

  return block;
}
