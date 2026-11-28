import type { ResponseAppendedMutation } from '../indexer/types';
import type { Sql } from './client';
import { markDirty, num } from './mutationSql';

export async function applyResponse(
  tx: Sql,
  chainId: number,
  mutation: ResponseAppendedMutation
): Promise<void> {
  await tx.query(
    `INSERT INTO feedback_responses
      (chain_id, tx_hash, log_index, token_id, client_address, feedback_index,
       responder, response_uri, response_hash, block_number, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (chain_id, tx_hash, log_index) DO NOTHING`,
    [
      chainId,
      mutation.txHash,
      mutation.logIndex,
      num(mutation.tokenId),
      mutation.client,
      num(mutation.feedbackIndex),
      mutation.responder,
      mutation.responseUri,
      mutation.responseHash,
      num(mutation.blockNumber),
      num(mutation.blockTimestamp),
    ]
  );
  await markDirty(tx, chainId, mutation.tokenId);
}
