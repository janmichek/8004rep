import type { ApplyChunk, Cursor, CursorWrite, IndexerStore } from '../indexer/types';
import type { QueryParam, Sql } from './client';
import { applyMutation } from './mutations';
import { cursorRowSchema } from './rowSchemas';

const CURSOR_COLUMNS =
  'chain_id, last_indexed_block, last_indexed_hash, head_block, status, last_error';

function cursorParams(cursor: CursorWrite): QueryParam[] {
  return [
    cursor.chainId,
    cursor.block.toString(),
    cursor.hash,
    cursor.headBlock === null ? null : cursor.headBlock.toString(),
    cursor.status,
    cursor.error,
  ];
}

const UPSERT_CURSOR = `INSERT INTO chain_cursors
  (chain_id, last_indexed_block, last_indexed_hash, head_block, status, last_error, updated_at)
  VALUES ($1, $2, $3, $4, $5, $6, NOW())
  ON CONFLICT (chain_id) DO UPDATE
    SET last_indexed_block = EXCLUDED.last_indexed_block,
        last_indexed_hash = EXCLUDED.last_indexed_hash,
        head_block = EXCLUDED.head_block,
        status = EXCLUDED.status,
        last_error = EXCLUDED.last_error,
        updated_at = NOW()`;

async function writeCursor(db: Sql, cursor: CursorWrite): Promise<void> {
  await db.query(UPSERT_CURSOR, cursorParams(cursor));
}

async function getCursor(db: Sql, chainId: number): Promise<Cursor | null> {
  const rows = await db.query(`SELECT ${CURSOR_COLUMNS} FROM chain_cursors WHERE chain_id = $1`, [
    chainId,
  ]);

  const row = rows[0];

  if (!row) return null;
  const parsed = cursorRowSchema.parse(row);

  return {
    chainId: parsed.chain_id,
    lastIndexedBlock: parsed.last_indexed_block,
    lastIndexedHash: parsed.last_indexed_hash,
    headBlock: parsed.head_block,
    status: parsed.status,
    lastError: parsed.last_error,
  };
}

async function applyChunk(db: Sql, chunk: ApplyChunk): Promise<void> {
  await db.transaction(async (tx) => {
    for (const mutation of chunk.mutations) {
      await applyMutation(tx, chunk.chainId, mutation);
    }

    await writeCursor(tx, chunk.cursor);
  });
}

type UnwindStep = { sql: string; usesBlock: boolean };

const UNWIND_STEPS: readonly UnwindStep[] = [
  {
    sql: `UPDATE agents SET score_dirty = TRUE
   WHERE chain_id = $1 AND token_id IN (
     SELECT token_id FROM feedbacks WHERE chain_id = $1 AND block_number > $2
     UNION SELECT token_id FROM feedback_responses WHERE chain_id = $1 AND block_number > $2
     UNION SELECT token_id FROM agent_transfers WHERE chain_id = $1 AND block_number > $2
     UNION SELECT token_id FROM feedbacks WHERE chain_id = $1 AND revoked_block > $2
   )`,
    usesBlock: true,
  },
  {
    sql: `UPDATE feedbacks
   SET revoked = FALSE, revoked_block = NULL, revoked_tx = NULL
   WHERE chain_id = $1 AND revoked_block > $2`,
    usesBlock: true,
  },
  {
    sql: 'DELETE FROM feedback_responses WHERE chain_id = $1 AND block_number > $2',
    usesBlock: true,
  },
  { sql: 'DELETE FROM feedbacks WHERE chain_id = $1 AND block_number > $2', usesBlock: true },
  {
    sql: `UPDATE agents
   SET metadata_fetched_at = NULL, metadata_attempts = 0,
       metadata_retry_after = NULL, metadata_error = NULL
   WHERE chain_id = $1 AND token_id IN (
     SELECT token_id FROM agent_metadata_kv WHERE chain_id = $1 AND block_number > $2
   )`,
    usesBlock: true,
  },
  {
    sql: `UPDATE agents a
   SET agent_wallet = (
     SELECT '0x' || right(encode(k.metadata_value, 'hex'), 40)
     FROM agent_metadata_kv k
     WHERE k.chain_id = $1 AND k.token_id = a.token_id
       AND k.metadata_key = 'agentWallet' AND k.block_number <= $2
     ORDER BY k.block_number DESC, k.log_index DESC
     LIMIT 1
   ), score_dirty = TRUE
   WHERE a.chain_id = $1
     AND (a.agent_wallet IS NOT NULL OR a.registered_block > $2)`,
    usesBlock: true,
  },
  {
    sql: 'DELETE FROM agent_metadata_kv WHERE chain_id = $1 AND block_number > $2',
    usesBlock: true,
  },
  {
    sql: 'DELETE FROM agent_transfers WHERE chain_id = $1 AND block_number > $2',
    usesBlock: true,
  },
  {
    sql: `UPDATE agents a
   SET owner = NULL, burned = FALSE
   WHERE a.chain_id = $1 AND a.registered_block > $2
     AND NOT EXISTS (
       SELECT 1 FROM agent_transfers t WHERE t.chain_id = $1 AND t.token_id = a.token_id
     )`,
    usesBlock: true,
  },
  {
    sql: `DELETE FROM agents a
   WHERE a.chain_id = $1 AND a.registered_block > $2
     AND NOT EXISTS (SELECT 1 FROM agent_transfers t WHERE t.chain_id = $1 AND t.token_id = a.token_id)
     AND NOT EXISTS (SELECT 1 FROM feedbacks f WHERE f.chain_id = $1 AND f.token_id = a.token_id)`,
    usesBlock: true,
  },
  {
    sql: `UPDATE agents a
   SET owner = t.to_address
   FROM (
     SELECT DISTINCT ON (token_id) token_id, to_address
     FROM agent_transfers WHERE chain_id = $1
     ORDER BY token_id, block_number DESC, log_index DESC
   ) t
   WHERE a.chain_id = $1 AND a.token_id = t.token_id`,
    usesBlock: false,
  },
];

async function unwind(
  db: Sql,
  chainId: number,
  aboveBlock: bigint,
  cursor: CursorWrite
): Promise<void> {
  await db.transaction(async (tx) => {
    for (const step of UNWIND_STEPS) {
      await tx.query(step.sql, step.usesBlock ? [chainId, aboveBlock.toString()] : [chainId]);
    }

    await writeCursor(tx, cursor);
  });
}

export function createIndexerStore(db: Sql): IndexerStore {
  return {
    getCursor: (chainId) => getCursor(db, chainId),
    applyChunk: (chunk) => applyChunk(db, chunk),
    writeCursor: (cursor) => writeCursor(db, cursor),
    unwind: (chainId, aboveBlock, cursor) => unwind(db, chainId, aboveBlock, cursor),
  };
}
