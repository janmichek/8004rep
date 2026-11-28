import { AGENT_WALLET_KEY } from '../../shared/erc8004Abi';
import type {
  FeedbackMutation,
  FeedbackRevokedMutation,
  MetadataSetMutation,
  Mutation,
  RegisteredMutation,
  TransferMutation,
  UriUpdatedMutation,
} from '../indexer/types';
import { ensureAgent, markDirty, num, ZERO } from './mutationSql';
import { applyResponse } from './responseMutation';
import type { Sql } from './client';

async function applyTransfer(tx: Sql, chainId: number, mutation: TransferMutation): Promise<void> {
  const tokenId = num(mutation.tokenId);
  await tx.query(
    `INSERT INTO agent_transfers
      (chain_id, tx_hash, log_index, token_id, from_address, to_address, block_number, block_timestamp)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (chain_id, tx_hash, log_index) DO NOTHING`,
    [
      chainId,
      mutation.txHash,
      mutation.logIndex,
      tokenId,
      mutation.from,
      mutation.to,
      num(mutation.blockNumber),
      num(mutation.blockTimestamp),
    ]
  );
  await tx.query(
    `INSERT INTO agents
      (chain_id, token_id, owner, registered_at, registered_block, registered_tx, burned, score_dirty)
     VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
     ON CONFLICT (chain_id, token_id) DO UPDATE
       SET owner = EXCLUDED.owner, burned = EXCLUDED.burned, score_dirty = TRUE`,
    [
      chainId,
      tokenId,
      mutation.to,
      num(mutation.blockTimestamp),
      num(mutation.blockNumber),
      mutation.txHash,
      mutation.to === ZERO,
    ]
  );
}

async function applyRegistered(
  tx: Sql,
  chainId: number,
  mutation: RegisteredMutation
): Promise<void> {
  await tx.query(
    `INSERT INTO agents
      (chain_id, token_id, owner, agent_uri, registered_at, registered_block, registered_tx)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (chain_id, token_id) DO UPDATE
       SET owner = EXCLUDED.owner,
           agent_uri = EXCLUDED.agent_uri,
           registered_at = COALESCE(agents.registered_at, EXCLUDED.registered_at),
           registered_tx = COALESCE(agents.registered_tx, EXCLUDED.registered_tx)`,
    [
      chainId,
      num(mutation.tokenId),
      mutation.owner,
      mutation.agentUri,
      num(mutation.blockTimestamp),
      num(mutation.blockNumber),
      mutation.txHash,
    ]
  );
}

async function applyUriUpdated(
  tx: Sql,
  chainId: number,
  mutation: UriUpdatedMutation
): Promise<void> {
  await tx.query(
    `INSERT INTO agents (chain_id, token_id, agent_uri, registered_block)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (chain_id, token_id) DO UPDATE
       SET agent_uri = EXCLUDED.agent_uri,
           metadata_fetched_at = NULL,
           metadata_attempts = 0,
           metadata_retry_after = NULL,
           metadata_error = NULL
       WHERE agents.agent_uri IS DISTINCT FROM EXCLUDED.agent_uri`,
    [chainId, num(mutation.tokenId), mutation.agentUri, num(mutation.blockNumber)]
  );
}

async function applyMetadataSet(
  tx: Sql,
  chainId: number,
  mutation: MetadataSetMutation
): Promise<void> {
  const tokenId = num(mutation.tokenId);
  await ensureAgent(tx, chainId, mutation.tokenId, mutation.blockNumber);
  await tx.query(
    `INSERT INTO agent_metadata_kv
      (chain_id, token_id, metadata_key, metadata_value, block_number, tx_hash, log_index)
     VALUES ($1, $2, $3, decode($4, 'hex'), $5, $6, $7)
     ON CONFLICT (chain_id, token_id, metadata_key) DO UPDATE
       SET metadata_value = EXCLUDED.metadata_value,
           block_number = EXCLUDED.block_number,
           tx_hash = EXCLUDED.tx_hash,
           log_index = EXCLUDED.log_index`,
    [
      chainId,
      tokenId,
      mutation.key,
      mutation.valueHex.slice(2),
      num(mutation.blockNumber),
      mutation.txHash,
      mutation.logIndex,
    ]
  );

  if (mutation.key !== AGENT_WALLET_KEY || mutation.wallet === null) return;

  await tx.query(
    `INSERT INTO agents (chain_id, token_id, agent_wallet, registered_block)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (chain_id, token_id) DO UPDATE
       SET agent_wallet = EXCLUDED.agent_wallet, score_dirty = TRUE`,
    [chainId, tokenId, mutation.wallet, num(mutation.blockNumber)]
  );
}

async function applyFeedback(tx: Sql, chainId: number, mutation: FeedbackMutation): Promise<void> {
  await tx.query(
    `INSERT INTO feedbacks
      (chain_id, token_id, client_address, feedback_index, value_raw, value_decimals, value_scaled,
       tag1, tag2, tag_key, endpoint, feedback_uri, feedback_hash, block_number, log_index, tx_hash, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
     ON CONFLICT (chain_id, token_id, client_address, feedback_index) DO UPDATE
       SET value_raw = EXCLUDED.value_raw,
           value_decimals = EXCLUDED.value_decimals,
           value_scaled = EXCLUDED.value_scaled,
           tag1 = EXCLUDED.tag1, tag2 = EXCLUDED.tag2, tag_key = EXCLUDED.tag_key,
           endpoint = EXCLUDED.endpoint, feedback_uri = EXCLUDED.feedback_uri,
           feedback_hash = EXCLUDED.feedback_hash, block_number = EXCLUDED.block_number,
           log_index = EXCLUDED.log_index, tx_hash = EXCLUDED.tx_hash,
           created_at = EXCLUDED.created_at, revoked = FALSE,
           revoked_block = NULL, revoked_tx = NULL`,
    [
      chainId,
      num(mutation.tokenId),
      mutation.client,
      num(mutation.feedbackIndex),
      mutation.valueRaw,
      mutation.valueDecimals,
      mutation.valueScaled,
      mutation.tag1,
      mutation.tag2,
      mutation.tagKey,
      mutation.endpoint,
      mutation.feedbackUri,
      mutation.feedbackHash,
      num(mutation.blockNumber),
      mutation.logIndex,
      mutation.txHash,
      num(mutation.blockTimestamp),
    ]
  );
  await markDirty(tx, chainId, mutation.tokenId);
}

async function applyRevoked(
  tx: Sql,
  chainId: number,
  mutation: FeedbackRevokedMutation
): Promise<void> {
  await ensureAgent(tx, chainId, mutation.tokenId, mutation.blockNumber);
  await tx.query(
    `UPDATE feedbacks
     SET revoked = TRUE, revoked_block = $5, revoked_tx = $6
     WHERE chain_id = $1 AND token_id = $2 AND client_address = $3 AND feedback_index = $4`,
    [
      chainId,
      num(mutation.tokenId),
      mutation.client,
      num(mutation.feedbackIndex),
      num(mutation.blockNumber),
      mutation.txHash,
    ]
  );
  await markDirty(tx, chainId, mutation.tokenId);
}

/** Applies one decoded event; every write is parameterized. */
export async function applyMutation(tx: Sql, chainId: number, mutation: Mutation): Promise<void> {
  switch (mutation.kind) {
    case 'transfer':
      await applyTransfer(tx, chainId, mutation);

      return;
    case 'registered':
      await applyRegistered(tx, chainId, mutation);

      return;
    case 'uri-updated':
      await applyUriUpdated(tx, chainId, mutation);

      return;
    case 'metadata-set':
      await applyMetadataSet(tx, chainId, mutation);

      return;
    case 'feedback':
      await applyFeedback(tx, chainId, mutation);

      return;
    case 'feedback-revoked':
      await applyRevoked(tx, chainId, mutation);

      return;
    case 'response-appended':
      await applyResponse(tx, chainId, mutation);
  }
}
