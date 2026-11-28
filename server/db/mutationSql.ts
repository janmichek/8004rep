import type { Sql } from './client';

export const ZERO = '0x0000000000000000000000000000000000000000';

export function num(value: bigint): string {
  return value.toString();
}

export async function ensureAgent(
  tx: Sql,
  chainId: number,
  tokenId: bigint,
  blockNumber: bigint
): Promise<void> {
  await tx.query(
    `INSERT INTO agents (chain_id, token_id, registered_block)
     VALUES ($1, $2, $3)
     ON CONFLICT (chain_id, token_id) DO NOTHING`,
    [chainId, num(tokenId), num(blockNumber)]
  );
}

export async function markDirty(tx: Sql, chainId: number, tokenId: bigint): Promise<void> {
  await tx.query('UPDATE agents SET score_dirty = TRUE WHERE chain_id = $1 AND token_id = $2', [
    chainId,
    num(tokenId),
  ]);
}
