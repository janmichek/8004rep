import { z } from 'zod';
import type { Agent, AgentDetailResponse, TagScale } from './agentTypes';
import { bigintFromDb, feedbackRowSchema, responseRowSchema } from './rowSchemas';

const nullableText = z.string().nullable();
const nullableNumber = z.union([z.number(), z.string()]).nullable();

const agentKeyFields = {
  chain_id: z.coerce.number(),
  token_id: z.union([z.string(), z.number()]).transform((value) => String(value)),
  name: nullableText,
  description: nullableText,
  image_url: nullableText,
  owner: nullableText,
};

export const listAgentRowSchema = z.object({
  ...agentKeyFields,
  protocols: z.array(z.string()).nullable(),
  x402: z.boolean(),
  score: nullableNumber,
  ci_low: nullableNumber,
  ci_high: nullableNumber,
  confidence: z.enum(['low', 'medium', 'high']).nullable(),
  unrated: z.boolean().nullable(),
  raw_average: nullableNumber,
  rated_rows: z.coerce.number().nullable(),
  unique_wallets: z.coerce.number().nullable(),
  feedback_count: z.coerce.number().nullable(),
  registered_at: bigintFromDb.nullable(),
});

export const agentDetailRowSchema = z.object({
  ...agentKeyFields,
  agent_wallet: nullableText,
  agent_uri: nullableText,
  active: z.boolean().nullable(),
  x402: z.boolean(),
  protocols: z.array(z.string()).nullable(),
  supported_trust: z.array(z.string()).nullable(),
  services_json: z.array(z.unknown()).nullable(),
  version: nullableText,
  registered_at: bigintFromDb.nullable(),
  feedback_count: z.coerce.number().nullable(),
});

const tagScaleRowSchema = z.object({
  tag_key: z.string(),
  scale: z.string(),
  span: z.coerce.number(),
});

const serviceJsonSchema = z.object({
  name: z.string(),
  endpoint: z.string(),
  version: z.string().optional(),
});

type ListRow = z.infer<typeof listAgentRowSchema>;

type DetailRow = z.infer<typeof agentDetailRowSchema>;

type FeedbackRow = z.infer<typeof feedbackRowSchema>;

function numberOrNull(value: string | number | null): number | null {
  return value === null ? null : Number(value);
}

function scoreFields(
  row: ListRow
): Pick<
  Agent,
  | 'score'
  | 'ciLow'
  | 'ciHigh'
  | 'confidence'
  | 'unrated'
  | 'rawAverage'
  | 'ratedRows'
  | 'uniqueWallets'
  | 'feedbackCount'
> {
  return {
    score: numberOrNull(row.score),
    ciLow: numberOrNull(row.ci_low),
    ciHigh: numberOrNull(row.ci_high),
    confidence: row.confidence ?? 'low',
    unrated: row.unrated ?? true,
    rawAverage: numberOrNull(row.raw_average),
    ratedRows: row.rated_rows ?? 0,
    uniqueWallets: row.unique_wallets ?? 0,
    feedbackCount: row.feedback_count ?? 0,
  };
}

function applyOptional(agent: Agent, row: ListRow): void {
  if (row.name) agent.name = row.name;

  if (row.description) agent.description = row.description;

  if (row.image_url) agent.imageUrl = row.image_url;

  if (row.registered_at !== null) agent.createdAt = Number(row.registered_at);
}

export function listAgent(row: ListRow, testnet: boolean): Agent {
  const agent: Agent = {
    chainId: row.chain_id,
    tokenId: row.token_id,
    owner: row.owner,
    protocols: row.protocols ?? [],
    x402: row.x402,
    formulaVersion: 'rep-1.0',
    testnet,
    ...scoreFields(row),
  };

  applyOptional(agent, row);

  return agent;
}

type RegistrationService = { name: string; endpoint: string; version?: string | undefined };

function servicesOf(rows: DetailRow['services_json']): RegistrationService[] {
  return (rows ?? []).flatMap((row) => {
    const parsed = serviceJsonSchema.safeParse(row);

    return parsed.success ? [parsed.data] : [];
  });
}

export type DetailArgs = {
  row: DetailRow;
  feedback: readonly FeedbackRow[];
  responses: Map<string, AgentDetailResponse['feedback'][number]['responses']>;
  tagScales: Record<string, TagScale>;
  testnet: boolean;
};

export function agentDetail(args: DetailArgs): AgentDetailResponse {
  const { row, feedback, responses, tagScales, testnet } = args;

  const items = feedback.map((parsed) => {
    const key = `${parsed.client_address}|${parsed.feedback_index.toString()}`;

    return {
      client: parsed.client_address,
      index: Number(parsed.feedback_index),
      value: parsed.value_scaled,
      tag1: parsed.tag1,
      tag2: parsed.tag2,
      endpoint: parsed.endpoint,
      feedbackURI: parsed.feedback_uri,
      revoked: parsed.revoked,
      createdAt: Number(parsed.created_at),
      txHash: parsed.tx_hash,
      responses: responses.get(key) ?? [],
    };
  });

  return {
    chainId: row.chain_id,
    tokenId: row.token_id,
    name: row.name,
    description: row.description,
    imageUrl: row.image_url,
    owner: row.owner,
    agentWallet: row.agent_wallet,
    agentUri: row.agent_uri,
    active: row.active,
    x402: row.x402,
    protocols: row.protocols ?? [],
    supportedTrust: row.supported_trust ?? [],
    services: servicesOf(row.services_json),
    version: row.version,
    registeredAt: row.registered_at === null ? null : Number(row.registered_at),
    feedbackCount: row.feedback_count ?? 0,
    testnet,
    tagScales,
    feedback: items,
  };
}

export function scatterResponses(rows: readonly object[]) {
  const byFeedback = new Map<string, AgentDetailResponse['feedback'][number]['responses']>();

  for (const row of rows) {
    const parsed = responseRowSchema.parse(row);
    const key = `${parsed.client_address}|${parsed.feedback_index.toString()}`;
    const list = byFeedback.get(key) ?? [];
    list.push({
      responder: parsed.responder,
      uri: parsed.response_uri,
      createdAt: Number(parsed.created_at),
      txHash: parsed.tx_hash,
    });
    byFeedback.set(key, list);
  }

  return byFeedback;
}

export type ScaleTables = {
  record: Record<string, TagScale>;
  map: Map<string, TagScale>;
};

export function scalesFromRows(rows: readonly object[]): ScaleTables {
  const map = new Map<string, TagScale>();

  for (const row of rows) {
    const parsed = tagScaleRowSchema.parse(row);

    const scale = z
      .enum(['binary', 'unit', 'five', 'ten', 'hundred', 'signed', 'unbounded'])
      .parse(parsed.scale);

    map.set(parsed.tag_key, { scale, span: parsed.span });
  }

  return { record: Object.fromEntries(map), map };
}
