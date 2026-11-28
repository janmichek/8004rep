import type { ParsedRegistration } from '../../shared/metadata/parseRegistration';
import type { MetadataStore, PendingMetadata } from '../indexer/metadataWorker';
import type { Sql } from './client';
import { pendingMetadataRowSchema } from './rowSchemas';

const PENDING = `SELECT chain_id, token_id, agent_uri, metadata_attempts
  FROM agents
  WHERE agent_uri IS NOT NULL
    AND metadata_fetched_at IS NULL
    AND (metadata_retry_after IS NULL OR metadata_retry_after <= NOW())
    AND metadata_attempts < 5
  ORDER BY metadata_attempts, chain_id, token_id
  LIMIT $1`;

const SAVE_METADATA = `UPDATE agents
  SET name = $3,
      description = $4,
      image_url = $5,
      active = $6,
      x402 = $7,
      protocols = $8,
      supported_trust = $9,
      services_json = $10::jsonb,
      version = $11,
      raw_metadata = $12::jsonb,
      metadata_fetched_at = NOW(),
      metadata_retry_after = NULL,
      metadata_error = NULL,
      score_dirty = TRUE
  WHERE chain_id = $1 AND token_id = $2`;

const SAVE_ERROR = `UPDATE agents
  SET metadata_attempts = metadata_attempts + 1,
      metadata_retry_after = to_timestamp($3),
      metadata_error = $4
  WHERE chain_id = $1 AND token_id = $2`;

export function createMetadataStore(db: Sql): MetadataStore {
  return {
    async pendingMetadata(limit: number): Promise<PendingMetadata[]> {
      const rows = await db.query(PENDING, [limit]);

      return rows.map((row) => {
        const parsed = pendingMetadataRowSchema.parse(row);

        return {
          chainId: parsed.chain_id,
          tokenId: parsed.token_id,
          agentUri: parsed.agent_uri,
          attempts: parsed.metadata_attempts,
        };
      });
    },

    async saveMetadata(agent: PendingMetadata, parsed: ParsedRegistration): Promise<void> {
      await db.query(SAVE_METADATA, [
        agent.chainId,
        agent.tokenId,
        parsed.name ?? null,
        parsed.description ?? null,
        parsed.image ?? null,
        parsed.active ?? null,
        parsed.x402,
        parsed.services.map((service) => service.name),
        parsed.supportedTrust,
        JSON.stringify(parsed.services),
        parsed.version ?? null,
        JSON.stringify(parsed.raw),
      ]);
    },

    async saveMetadataError(agent: PendingMetadata, error: string, retryAt: number): Promise<void> {
      await db.query(SAVE_ERROR, [agent.chainId, agent.tokenId, retryAt, error]);
    },
  };
}
