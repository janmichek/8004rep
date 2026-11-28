import { z } from 'zod';

const confidenceSchema = z.enum(['low', 'medium', 'high']);
const scaleSchema = z.enum(['binary', 'unit', 'five', 'ten', 'hundred', 'signed', 'unbounded']);
const kindSchema = z.enum(['rating', 'outcome', 'telemetry', 'metric', 'unknown']);

const tagScaleSchema = z.object({ scale: scaleSchema, span: z.number() });

const tagScalesSchema = z.record(z.string(), tagScaleSchema);

const serviceSchema = z.object({
  name: z.string(),
  endpoint: z.string(),
  version: z.string().optional(),
});

const feedbackResponseSchema = z.object({
  responder: z.string(),
  uri: z.string().nullable(),
  createdAt: z.number().int().nullable(),
  txHash: z.string().nullable(),
});

const feedbackSchema = z.object({
  client: z.string(),
  index: z.number().int().min(0),
  value: z.number(),
  tag1: z.string().nullable(),
  tag2: z.string().nullable(),
  endpoint: z.string().nullable(),
  feedbackURI: z.string().nullable(),
  revoked: z.boolean(),
  createdAt: z.number().int().nullable(),
  txHash: z.string().nullable(),
  responses: z.array(feedbackResponseSchema),
});

export const reputationSpecSchema = z.object({
  formulaVersion: z.literal('rep-1.0'),
  params: z.object({
    alpha0: z.number(),
    mu0: z.number(),
    unitWindowDays: z.number(),
    halfLifeDays: z.number(),
    fakeTarget: z.number(),
  }),
  confidenceRules: z.object({
    thinWeight: z.number(),
    thinWallets: z.number(),
    strongWeight: z.number(),
    strongNeff: z.number(),
    dominantShare: z.number(),
  }),
  kinds: z.array(z.object({ kind: kindSchema, label: z.string(), rule: z.string() })),
  steps: z.array(z.object({ id: z.string(), label: z.string(), rule: z.string() })),
  specUrl: z.string(),
});

const reputationReportSchema = z.object({
  score: z.number().nullable(),
  interval: z.tuple([z.number(), z.number()]).nullable(),
  confidence: confidenceSchema,
  unrated: z.boolean(),
  raw: z.number().nullable(),
  rawRatings: z.number().nullable(),
  inflation: z.number().nullable(),
  cost: z.number().nullable(),
  funnel: z.object({
    feedback: z.number(),
    ratedRows: z.number(),
    wallets: z.number(),
    units: z.number(),
    walletsAfterCap: z.number(),
  }),
  concentration: z.object({
    top1: z.number(),
    top3: z.number(),
    neff: z.number(),
    maxInfluence: z.number(),
    rawTop1: z.number(),
    rawTop3: z.number(),
    rawNeff: z.number(),
  }),
  contributions: z.array(
    z.object({
      client: z.string(),
      weight: z.number(),
      share: z.number(),
      rating: z.number(),
      without: z.number().nullable(),
    })
  ),
  waterfall: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      rule: z.string(),
      average: z.number().nullable(),
      rows: z.number(),
      delta: z.number().nullable(),
    })
  ),
  counts: z.object({
    total: z.number(),
    revoked: z.number(),
    rating: z.number(),
    outcome: z.number(),
    telemetry: z.number(),
    metric: z.number(),
    unknown: z.number(),
    outOfScale: z.number(),
    self: z.number(),
  }),
  byKind: z.array(z.object({ kind: kindSchema, label: z.string(), rows: z.number() })),
  telemetry: z.array(
    z.object({
      tag: z.string(),
      label: z.string(),
      rows: z.number(),
      clients: z.number(),
      latest: z.number().nullable(),
      median: z.number().nullable(),
    })
  ),
  findings: z.array(
    z.object({
      level: z.enum(['warn', 'info']),
      code: z.enum(['repeat', 'template', 'revocations', 'review-bomb', 'same-tx', 'burst']),
      text: z.string(),
    })
  ),
  responsiveness: z.object({
    lowRatings: z.number(),
    responded: z.number(),
    share: z.number().nullable(),
    medianLagDays: z.number().nullable(),
    ownerReplies: z.number(),
    thirdPartyReplies: z.number(),
  }),
});

export const agentReputationResponseSchema = z.object({
  chainId: z.number().int(),
  tokenId: z.string().regex(/^\d+$/),
  formulaVersion: z.literal('rep-1.0'),
  computedAt: z.number().int(),
  contentHash: z.string(),
  tagScales: tagScalesSchema,
  report: reputationReportSchema,
});

export const agentDetailResponseSchema = z.object({
  chainId: z.number().int(),
  tokenId: z.string().regex(/^\d+$/),
  name: z.string().nullable(),
  description: z.string().nullable(),
  imageUrl: z.string().nullable(),
  owner: z.string().nullable(),
  agentWallet: z.string().nullable(),
  agentUri: z.string().nullable(),
  active: z.boolean().nullable(),
  x402: z.boolean(),
  protocols: z.array(z.string()),
  supportedTrust: z.array(z.string()),
  services: z.array(serviceSchema),
  version: z.string().nullable(),
  registeredAt: z.number().int().nullable(),
  feedbackCount: z.number().int().min(0),
  testnet: z.boolean(),
  tagScales: tagScalesSchema,
  feedback: z.array(feedbackSchema),
});

export type ReputationSpec = z.infer<typeof reputationSpecSchema>;

export type AgentReputationResponse = z.infer<typeof agentReputationResponseSchema>;

export type AgentDetailResponse = z.infer<typeof agentDetailResponseSchema>;
