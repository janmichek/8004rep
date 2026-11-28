-- 8004rep independent ERC-8004 indexer schema.
-- Every row is keyed by chain because token ids repeat between networks.

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chain_cursors (
  chain_id INTEGER PRIMARY KEY,
  last_indexed_block BIGINT NOT NULL,
  last_indexed_hash TEXT,
  head_block BIGINT,
  status TEXT NOT NULL DEFAULT 'idle',
  last_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agents (
  chain_id INTEGER NOT NULL,
  token_id NUMERIC(78, 0) NOT NULL,
  owner TEXT,
  agent_wallet TEXT,
  agent_uri TEXT,
  registered_at BIGINT,
  registered_block BIGINT NOT NULL,
  registered_tx TEXT,
  burned BOOLEAN NOT NULL DEFAULT FALSE,
  name TEXT,
  description TEXT,
  image_url TEXT,
  active BOOLEAN,
  x402 BOOLEAN NOT NULL DEFAULT FALSE,
  protocols TEXT[] NOT NULL DEFAULT '{}',
  supported_trust TEXT[] NOT NULL DEFAULT '{}',
  services_json JSONB NOT NULL DEFAULT '[]',
  version TEXT,
  raw_metadata JSONB,
  metadata_fetched_at TIMESTAMPTZ,
  metadata_attempts SMALLINT NOT NULL DEFAULT 0,
  metadata_retry_after TIMESTAMPTZ,
  metadata_error TEXT,
  score_dirty BOOLEAN NOT NULL DEFAULT TRUE,
  search_tsv TSVECTOR GENERATED ALWAYS AS (
    to_tsvector(
      'simple',
      coalesce(name, '') || ' ' || coalesce(description, '') || ' ' || token_id::text || ' ' || coalesce(owner, '')
    )
  ) STORED,
  PRIMARY KEY (chain_id, token_id)
);

CREATE INDEX IF NOT EXISTS agents_search_idx ON agents USING GIN (search_tsv);
CREATE INDEX IF NOT EXISTS agents_owner_idx ON agents (chain_id, owner);
CREATE INDEX IF NOT EXISTS agents_registered_idx ON agents (chain_id, registered_at DESC);
CREATE INDEX IF NOT EXISTS agents_dirty_idx ON agents (chain_id, token_id) WHERE score_dirty = TRUE;
CREATE INDEX IF NOT EXISTS agents_metadata_retry_idx ON agents (metadata_retry_after)
  WHERE agent_uri IS NOT NULL AND metadata_fetched_at IS NULL AND metadata_attempts < 5;

CREATE TABLE IF NOT EXISTS agent_transfers (
  chain_id INTEGER NOT NULL,
  tx_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  token_id NUMERIC(78, 0) NOT NULL,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  block_number BIGINT NOT NULL,
  block_timestamp BIGINT NOT NULL,
  PRIMARY KEY (chain_id, tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS agent_transfers_block_idx ON agent_transfers (chain_id, block_number);
CREATE INDEX IF NOT EXISTS agent_transfers_token_idx ON agent_transfers (chain_id, token_id, block_number);

CREATE TABLE IF NOT EXISTS agent_metadata_kv (
  chain_id INTEGER NOT NULL,
  token_id NUMERIC(78, 0) NOT NULL,
  metadata_key TEXT NOT NULL,
  metadata_value BYTEA NOT NULL,
  block_number BIGINT NOT NULL,
  tx_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  PRIMARY KEY (chain_id, token_id, metadata_key)
);

CREATE TABLE IF NOT EXISTS feedbacks (
  chain_id INTEGER NOT NULL,
  token_id NUMERIC(78, 0) NOT NULL,
  client_address TEXT NOT NULL,
  feedback_index BIGINT NOT NULL,
  value_raw NUMERIC(39, 0) NOT NULL,
  value_decimals SMALLINT NOT NULL,
  value_scaled DOUBLE PRECISION NOT NULL,
  tag1 TEXT,
  tag2 TEXT,
  tag_key TEXT NOT NULL,
  endpoint TEXT,
  feedback_uri TEXT,
  feedback_hash TEXT,
  revoked BOOLEAN NOT NULL DEFAULT FALSE,
  revoked_block BIGINT,
  revoked_tx TEXT,
  block_number BIGINT NOT NULL,
  log_index INTEGER NOT NULL,
  tx_hash TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  PRIMARY KEY (chain_id, token_id, client_address, feedback_index)
);

CREATE INDEX IF NOT EXISTS feedbacks_block_idx ON feedbacks (chain_id, block_number);
CREATE INDEX IF NOT EXISTS feedbacks_created_idx ON feedbacks (chain_id, created_at DESC);
CREATE INDEX IF NOT EXISTS feedbacks_reviewer_idx ON feedbacks (chain_id, client_address, created_at DESC);
CREATE INDEX IF NOT EXISTS feedbacks_tag_idx ON feedbacks (chain_id, tag_key) WHERE NOT revoked;

CREATE TABLE IF NOT EXISTS feedback_responses (
  chain_id INTEGER NOT NULL,
  tx_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  token_id NUMERIC(78, 0) NOT NULL,
  client_address TEXT NOT NULL,
  feedback_index BIGINT NOT NULL,
  responder TEXT NOT NULL,
  response_uri TEXT,
  response_hash TEXT,
  block_number BIGINT NOT NULL,
  created_at BIGINT NOT NULL,
  PRIMARY KEY (chain_id, tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS feedback_responses_feedback_idx
  ON feedback_responses (chain_id, token_id, client_address, feedback_index);
CREATE INDEX IF NOT EXISTS feedback_responses_block_idx ON feedback_responses (chain_id, block_number);

CREATE TABLE IF NOT EXISTS tag_scales (
  chain_id INTEGER NOT NULL,
  tag_key TEXT NOT NULL,
  scale TEXT NOT NULL,
  span DOUBLE PRECISION NOT NULL,
  sample_count INTEGER NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (chain_id, tag_key)
);

CREATE TABLE IF NOT EXISTS agent_scores (
  chain_id INTEGER NOT NULL,
  token_id NUMERIC(78, 0) NOT NULL,
  formula_version TEXT NOT NULL,
  score DOUBLE PRECISION,
  ci_low DOUBLE PRECISION,
  ci_high DOUBLE PRECISION,
  confidence TEXT NOT NULL,
  unrated BOOLEAN NOT NULL,
  raw_average DOUBLE PRECISION,
  raw_ratings_average DOUBLE PRECISION,
  inflation DOUBLE PRECISION,
  feedback_count INTEGER NOT NULL DEFAULT 0,
  rated_rows INTEGER NOT NULL DEFAULT 0,
  unique_wallets INTEGER NOT NULL DEFAULT 0,
  rating_units INTEGER NOT NULL DEFAULT 0,
  total_weight DOUBLE PRECISION NOT NULL DEFAULT 0,
  neff DOUBLE PRECISION NOT NULL DEFAULT 0,
  top1_share DOUBLE PRECISION NOT NULL DEFAULT 0,
  cost_to_fake INTEGER,
  scored_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (chain_id, token_id),
  CONSTRAINT agent_scores_agent_fk FOREIGN KEY (chain_id, token_id)
    REFERENCES agents (chain_id, token_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS agent_scores_rank_idx ON agent_scores (score DESC NULLS LAST, feedback_count DESC);
CREATE INDEX IF NOT EXISTS agent_scores_chain_rank_idx
  ON agent_scores (chain_id, score DESC NULLS LAST, feedback_count DESC);
CREATE INDEX IF NOT EXISTS agent_scores_feedback_idx ON agent_scores (feedback_count DESC, score DESC NULLS LAST);
