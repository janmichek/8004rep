import { z } from 'zod';

/** BIGINT and NUMERIC arrive as strings from postgres.js; both become bigint. */
export const bigintFromDb = z
  .union([z.string(), z.number(), z.bigint()])
  .transform((value) => BigInt(value));

export const cursorRowSchema = z.object({
  chain_id: z.coerce.number(),
  last_indexed_block: bigintFromDb,
  last_indexed_hash: z.string().nullable(),
  head_block: bigintFromDb.nullable(),
  status: z.enum(['idle', 'syncing', 'ok', 'error']),
  last_error: z.string().nullable(),
});

export const pendingMetadataRowSchema = z.object({
  chain_id: z.coerce.number(),
  token_id: z.union([z.string(), z.number()]).transform((value) => String(value)),
  agent_uri: z.string(),
  metadata_attempts: z.coerce.number(),
});

const feedbackKeyFields = {
  chain_id: z.coerce.number(),
  token_id: z.union([z.string(), z.number()]).transform((value) => String(value)),
  client_address: z.string(),
  feedback_index: bigintFromDb,
};

export const feedbackRowSchema = z.object({
  ...feedbackKeyFields,
  endpoint: z.string().nullable(),
  feedback_uri: z.string().nullable(),
  value_scaled: z.coerce.number(),
  tag1: z.string().nullable(),
  tag2: z.string().nullable(),
  revoked: z.boolean(),
  created_at: bigintFromDb,
  tx_hash: z.string(),
});

export const responseRowSchema = z.object({
  ...feedbackKeyFields,
  responder: z.string(),
  response_uri: z.string().nullable(),
  created_at: bigintFromDb,
  tx_hash: z.string(),
});

export const agentRowSchema = z.object({
  chain_id: z.coerce.number(),
  token_id: z.union([z.string(), z.number()]).transform((value) => String(value)),
  owner: z.string().nullable(),
  agent_wallet: z.string().nullable(),
});

export const selfRowSchema = z.object({
  owner: z.string().nullable(),
  agent_wallet: z.string().nullable(),
});
