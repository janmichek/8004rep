import { z } from 'zod';

// wires what the API sends and frontend can trust.
// types are derived from the schemas, so they can't drift.
// `bun run api:generate` turns these into shared/openapi.json and the typed client.
const avatarColorSchema = z.enum(['gray', 'orange', 'iris', 'blue', 'teal']);

/** One agent as the list API sends it; `tokenId` stays a string on the wire. */
const agentSchema = z.object({
  chainId: z.number().int(),
  tokenId: z.string().regex(/^\d+$/),
  name: z.string().optional(),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  owner: z.string().nullable(),
  protocols: z.array(z.string()),
  x402: z.boolean(),
  totalScore: z.number(),
  averageScore: z.number(),
  feedbackCount: z.number().int().min(0),
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
const agentSortSchema = z.enum(['registered', 'score', 'feedback']);

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
};

export const agentsQuerySchema = z.object(agentQueryFields);

export const networkSchema = z.object({
  code: z.string(),
  name: z.string(),
  symbol: z.string(),
  color: avatarColorSchema,
  chainId: z.number(),
  testnet: z.boolean(),
});

export type Agent = z.infer<typeof agentSchema>;

export type AgentPage = z.infer<typeof agentPageSchema>;

export type AgentsQuery = z.infer<typeof agentsQuerySchema>;

export type Network = z.infer<typeof networkSchema>;
