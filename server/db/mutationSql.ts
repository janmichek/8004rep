import type { Sql } from './client';

export const ZERO = '0x0000000000000000000000000000000000000000';

export function num(value: bigint): string {
  return value.toString();
}

export async function markDirty(tx: Sql, chainId: number, tokenId: bigint): Promise<void> {
  await tx.query('UPDATE agents SET score_dirty = TRUE WHERE chain_id = $1 AND token_id = $2', [
    chainId,
    num(tokenId),
  ]);
}
