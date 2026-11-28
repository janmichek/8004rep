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

const UNWIND_STEPS: readonly string[] = [
  `UPDATE agents SET score_dirty = TRUE
   WHERE chain_id = $1 AND token_id IN (
     SELECT token_id FROM feedbacks WHERE chain_id = $1 AND block_number > $2
     UNION SELECT token_id FROM feedback_responses WHERE chain_id = $1 AND block_number > $2
     UNION SELECT token_id FROM agent_transfers WHERE chain_id = $1 AND block_number > $2
   )`,
  `UPDATE feedbacks
   SET revoked = FALSE, revoked_block = NULL, revoked_tx = NULL
   WHERE chain_id = $1 AND revoked_block > $2`,
  'DELETE FROM feedback_responses WHERE chain_id = $1 AND block_number > $2',
  'DELETE FROM feedbacks WHERE chain_id = $1 AND block_number > $2',
  'DELETE FROM agent_metadata_kv WHERE chain_id = $1 AND block_number > $2',
  'DELETE FROM agent_transfers WHERE chain_id = $1 AND block_number > $2',
  `UPDATE agents a
   SET owner = t.to_address
   FROM (
     SELECT DISTINCT ON (token_id) token_id, to_address
     FROM agent_transfers WHERE chain_id = $1
     ORDER BY token_id, block_number DESC, log_index DESC
   ) t
   WHERE a.chain_id = $1 AND a.token_id = t.token_id`,
];

async function unwind(
  db: Sql,
  chainId: number,
  aboveBlock: bigint,
  cursor: CursorWrite
): Promise<void> {
  await db.transaction(async (tx) => {
    for (const statement of UNWIND_STEPS) {
      await tx.query(statement, [chainId, aboveBlock.toString()]);
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
