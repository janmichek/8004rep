import { z } from 'zod';

// wires what the API sends and frontend can trust.
// types are derived from the schemas, so they can't drift.
// `bun run api:generate` turns these into shared/openapi.json and the typed client.
const avatarColorSchema = z.enum(['gray', 'orange', 'iris', 'blue', 'teal']);

export const agentSchema = z.object({
  id: z.number(),
  network: z.string(),
  name: z.string(),
  owner: z.string(),
  feedbackCount: z.number(),
  score: z.number().nullable(),
  status: z.enum(['active', 'quiet', 'unreviewed']),
  registeredAt: z.iso.datetime(),
});

export const networkSchema = z.object({
  code: z.string(),
  name: z.string(),
  symbol: z.string(),
  color: avatarColorSchema,
  chainId: z.number(),
  testnet: z.boolean(),
});

export type Agent = z.infer<typeof agentSchema>;

export type Network = z.infer<typeof networkSchema>;
