import { z } from 'zod';

export {
  agentDetailResponseSchema,
  agentReputationResponseSchema,
  reputationSpecSchema,
  type AgentDetailResponse,
  type AgentReputationResponse,
  type ReputationSpec,
} from './reputationSchemas';

// wires what the API sends and frontend can trust.
// types are derived from the schemas, so they can't drift.
// `bun run api:generate` turns these into shared/openapi.json and the typed client.
const avatarColorSchema = z.enum(['gray', 'orange', 'iris', 'blue', 'teal']);
const confidenceSchema = z.enum(['low', 'medium', 'high']);

const agentSchema = z.object({
  chainId: z.number().int(),
  tokenId: z.string().regex(/^\d+$/),
  name: z.string().optional(),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  owner: z.string().nullable(),
  protocols: z.array(z.string()),
  x402: z.boolean(),
  /** 0–100 `rep-1.0` filtered score; null when unrated. */
  score: z.number().nullable(),
  ciLow: z.number().nullable(),
  ciHigh: z.number().nullable(),
  confidence: confidenceSchema,
  unrated: z.boolean(),
  rawAverage: z.number().nullable(),
  ratedRows: z.number().int().min(0),
  uniqueWallets: z.number().int().min(0),
  feedbackCount: z.number().int().min(0),
  formulaVersion: z.literal('rep-1.0'),
  /** Unix seconds. */
  createdAt: z.number().int().optional(),
  testnet: z.boolean(),
});

export const agentPageSchema = z.object({
  items: z.array(agentSchema),
  total: z.number().int().min(0),
  hasMore: z.boolean(),
});

/** Sorts the list endpoint can run; the values are the UI's column names. */
const agentSortSchema = z.enum(['registered', 'score', 'feedback', 'tokenId']);

/** One entry per `/api/agents` query parameter; the OpenAPI generator reads this object. */
export const agentQueryFields = {
  q: z.string().trim().min(1).max(200).optional(),
  chain: z.coerce.number().int().positive().optional(),
  env: z.enum(['mainnet', 'testnet']).optional(),
  sort: agentSortSchema.optional(),
  order: z.enum(['asc', 'desc']).optional(),
  /** Zero-based; the client's page cursor. */
  page: z.coerce.number().int().min(0).max(10_000).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  /** Only agents with at least one feedback row. */
  ratedOnly: z.stringbool().optional(),
  /** Comma-separated `chainId:tokenId` batch lookup for starred/pinned rows. */
  ids: z.string().max(4000).optional(),
};

export const agentsQuerySchema = z.object(agentQueryFields);

export const networkSchema = z.object({
  code: z.string(),
  name: z.string(),
  shortName: z.string(),
  slug: z.string(),
  symbol: z.string(),
  color: avatarColorSchema,
  chainId: z.number(),
  testnet: z.boolean(),
  lastIndexedBlock: z.number().int().nullable(),
  syncStatus: z.enum(['idle', 'syncing', 'ok', 'error']),
  syncedAt: z.number().int().nullable(),
});

export const networkStatsSchema = z.object({
  chainId: z.number().int(),
  totalAgents: z.number().int().min(0),
  ratedAgents: z.number().int().min(0),
  totalFeedback: z.number().int().min(0),
  feedback30d: z.number().int().min(0),
  lastIndexedBlock: z.number().int().nullable(),
  syncedAt: z.number().int().nullable(),
});

export type Agent = z.infer<typeof agentSchema>;

export type AgentPage = z.infer<typeof agentPageSchema>;

export type AgentsQuery = z.infer<typeof agentsQuerySchema>;

export type Network = z.infer<typeof networkSchema>;

export type NetworkStats = z.infer<typeof networkStatsSchema>;
