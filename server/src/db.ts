import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import { DB_PATH } from './config'

export const db = new DatabaseSync(DB_PATH)

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA busy_timeout = 5000;
  PRAGMA foreign_keys = OFF;
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS sync_state (
    chain_id INTEGER NOT NULL,
    stream TEXT NOT NULL,
    last_block TEXT NOT NULL DEFAULT '0',
    head_block TEXT,
    updated_at INTEGER,
    last_error TEXT,
    PRIMARY KEY (chain_id, stream)
  );

  CREATE TABLE IF NOT EXISTS agents (
    chain_id INTEGER NOT NULL,
    token_id TEXT NOT NULL,
    owner TEXT,
    agent_wallet TEXT,
    agent_uri TEXT,
    created_at INTEGER,
    created_block TEXT,
    name TEXT,
    description TEXT,
    image TEXT,
    active INTEGER,
    x402 INTEGER,
    services_json TEXT,
    supported_trust_json TEXT,
    raw_file_json TEXT,
    file_fetched_at INTEGER,
    file_error TEXT,
    needs_recompute INTEGER NOT NULL DEFAULT 1,
    updated_at INTEGER,
    PRIMARY KEY (chain_id, token_id)
  );
  CREATE INDEX IF NOT EXISTS agents_created ON agents(created_at DESC);
  CREATE INDEX IF NOT EXISTS agents_chain_created ON agents(chain_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS agents_owner ON agents(owner);
  CREATE INDEX IF NOT EXISTS agents_name ON agents(name COLLATE NOCASE);
  CREATE INDEX IF NOT EXISTS agents_token ON agents(chain_id, token_id);

  CREATE TABLE IF NOT EXISTS agent_transfers (
    chain_id INTEGER NOT NULL,
    tx_hash TEXT NOT NULL,
    log_index INTEGER NOT NULL,
    token_id TEXT NOT NULL,
    from_addr TEXT,
    to_addr TEXT,
    block_number TEXT NOT NULL,
    created_at INTEGER,
    PRIMARY KEY (chain_id, tx_hash, log_index)
  );

  CREATE TABLE IF NOT EXISTS feedback (
    chain_id INTEGER NOT NULL,
    token_id TEXT NOT NULL,
    client TEXT NOT NULL,
    feedback_index INTEGER NOT NULL,
    value_raw TEXT,
    value_decimals INTEGER,
    value REAL NOT NULL,
    tag1 TEXT,
    tag2 TEXT,
    endpoint TEXT,
    feedback_uri TEXT,
    feedback_hash TEXT,
    revoked INTEGER NOT NULL DEFAULT 0,
    revoked_block TEXT,
    revoked_tx_hash TEXT,
    block_number TEXT,
    log_index INTEGER,
    tx_hash TEXT,
    tx_from TEXT,
    tx_to TEXT,
    tx_fee_wei TEXT,
    tx_feedback_count INTEGER,
    created_at INTEGER,
    PRIMARY KEY (chain_id, token_id, client, feedback_index)
  );
  CREATE INDEX IF NOT EXISTS feedback_created ON feedback(created_at DESC);
  CREATE INDEX IF NOT EXISTS feedback_chain_created ON feedback(chain_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS feedback_agent ON feedback(chain_id, token_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS feedback_client ON feedback(client);
  CREATE INDEX IF NOT EXISTS feedback_uri ON feedback(feedback_uri);

  CREATE TABLE IF NOT EXISTS feedback_responses (
    chain_id INTEGER NOT NULL,
    tx_hash TEXT NOT NULL,
    log_index INTEGER NOT NULL,
    token_id TEXT NOT NULL,
    client TEXT NOT NULL,
    feedback_index INTEGER NOT NULL,
    responder TEXT NOT NULL,
    response_uri TEXT,
    block_number TEXT,
    created_at INTEGER,
    PRIMARY KEY (chain_id, tx_hash, log_index)
  );
  CREATE INDEX IF NOT EXISTS responses_row ON feedback_responses(chain_id, token_id, client, feedback_index);

  CREATE TABLE IF NOT EXISTS feedback_files (
    uri TEXT PRIMARY KEY,
    scheme TEXT,
    content_hash TEXT,
    canonical_hash TEXT,
    comment_text TEXT,
    payment_tx_hash TEXT,
    payment_chain_id INTEGER,
    payment_verified INTEGER,
    payment_facts_json TEXT,
    raw_json TEXT,
    fetched_at INTEGER,
    error TEXT
  );
  CREATE INDEX IF NOT EXISTS feedback_files_payment ON feedback_files(payment_chain_id, payment_tx_hash);

  CREATE TABLE IF NOT EXISTS wallets (
    chain_id INTEGER NOT NULL,
    address TEXT NOT NULL,
    nonce INTEGER,
    kind TEXT,
    first_funder TEXT,
    funding_tx_hash TEXT,
    funding_timestamp INTEGER,
    funding_value_wei TEXT,
    funding_root TEXT,
    funding_depth INTEGER,
    funding_path_json TEXT,
    traced_at INTEGER,
    trace_error TEXT,
    PRIMARY KEY (chain_id, address)
  );

  CREATE TABLE IF NOT EXISTS agent_scores (
    chain_id INTEGER NOT NULL,
    token_id TEXT NOT NULL,
    formula_version TEXT NOT NULL,
    filtered_score REAL,
    interval_lo REAL,
    interval_hi REAL,
    confidence TEXT,
    unrated INTEGER,
    raw_score REAL,
    raw_ratings REAL,
    inflation_gap REAL,
    cost_to_fake REAL,
    total_feedback INTEGER,
    rated_rows INTEGER,
    wallets_count INTEGER,
    entities_count INTEGER,
    neff REAL,
    top1 REAL,
    risk_level TEXT,
    evidence_backed_share REAL,
    scan_score REAL,
    scan_json TEXT,
    scan_fetched_at INTEGER,
    report_json TEXT,
    stats_json TEXT,
    trust_report_json TEXT,
    computed_at INTEGER,
    PRIMARY KEY (chain_id, token_id)
  );
  CREATE INDEX IF NOT EXISTS scores_chain_filtered ON agent_scores(chain_id, filtered_score DESC);
  CREATE INDEX IF NOT EXISTS scores_chain_feedback ON agent_scores(chain_id, total_feedback DESC);
  CREATE INDEX IF NOT EXISTS scores_chain_gap ON agent_scores(chain_id, inflation_gap DESC);

  CREATE TABLE IF NOT EXISTS network_snapshots (
    chain_id INTEGER NOT NULL,
    window_key TEXT NOT NULL,
    stats_json TEXT NOT NULL,
    computed_at INTEGER NOT NULL,
    PRIMARY KEY (chain_id, window_key)
  );

  CREATE TABLE IF NOT EXISTS score_snapshots (
    chain_id INTEGER NOT NULL,
    token_id TEXT NOT NULL,
    day_utc TEXT NOT NULL,
    filtered_score REAL,
    raw_score REAL,
    wallets_count INTEGER,
    feedback_count INTEGER,
    PRIMARY KEY (chain_id, token_id, day_utc)
  );
`)

export function all<T>(sql: string, ...params: SQLInputValue[]): T[] {
  return db.prepare(sql).all(...params) as T[]
}

export function get<T>(sql: string, ...params: SQLInputValue[]): T | undefined {
  return db.prepare(sql).get(...params) as T | undefined
}

export function run(sql: string, ...params: SQLInputValue[]) {
  return db.prepare(sql).run(...params)
}

/** Runs `fn` in one transaction; a throw rolls everything back. */
export function transaction<T>(fn: () => T): T {
  db.exec('BEGIN IMMEDIATE')
  try {
    const value = fn()
    db.exec('COMMIT')
    return value
  } catch (error) {
    try {
      db.exec('ROLLBACK')
    } catch {
      // The transaction is already gone; the original error is the useful one.
    }
    throw error
  }
}

export function touchSync(
  chainId: number,
  stream: string,
  lastBlock?: bigint,
  headBlock?: bigint,
  error?: string | null,
  lastHash?: string | null,
): void {
  const now = Math.floor(Date.now() / 1000)
  const existing = getSync(chainId, stream)
  run(
    `INSERT INTO sync_state (chain_id, stream, last_block, head_block, updated_at, last_error, last_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(chain_id, stream) DO UPDATE SET
       last_block = COALESCE(excluded.last_block, sync_state.last_block),
       head_block = COALESCE(excluded.head_block, sync_state.head_block),
       updated_at = excluded.updated_at,
       last_error = excluded.last_error,
       last_hash = COALESCE(excluded.last_hash, sync_state.last_hash)`,
    chainId,
    stream,
    lastBlock?.toString() ?? existing?.last_block ?? '0',
    headBlock?.toString() ?? existing?.head_block ?? null,
    now,
    error ?? null,
    lastHash ?? null,
  )
}

export function getSync(
  chainId: number,
  stream: string,
): { last_block: string; head_block: string | null; updated_at: number | null; last_error: string | null; last_hash: string | null } | undefined {
  return get(
    'SELECT last_block, head_block, updated_at, last_error, last_hash FROM sync_state WHERE chain_id = ? AND stream = ?',
    chainId,
    stream,
  )
}

/** Adds a column to an existing database; SQLite has no IF NOT EXISTS for ALTER. */
function addColumn(table: string, column: string, ddl: string): void {
  const columns = all<{ name: string }>(`PRAGMA table_info(${table})`)
  if (!columns.some((entry) => entry.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`)
}

addColumn('sync_state', 'last_hash', 'TEXT')
addColumn('agents', 'owner_block', 'TEXT')
addColumn('agents', 'detail_synced_at', 'INTEGER')
addColumn('agents', 'file_next_try_at', 'INTEGER')
addColumn('agents', 'file_attempts', 'INTEGER NOT NULL DEFAULT 0')
addColumn('agents', 'rpc_error', 'TEXT')
addColumn('agents', 'score_attempts', 'INTEGER NOT NULL DEFAULT 0')
addColumn('agents', 'score_next_try_at', 'INTEGER')
addColumn('agents', 'rpc_checked_at', 'INTEGER')
addColumn('feedback_files', 'next_try_at', 'INTEGER')
addColumn('feedback_files', 'attempts', 'INTEGER NOT NULL DEFAULT 0')
