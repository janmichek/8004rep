import { z } from 'zod';
import { catalogChain } from '../../shared/chains';
import { buildReputationReport, hashEvidence } from '../../shared/reputation';
import {
  agentDetailResponseSchema,
  agentPageSchema,
  agentReputationResponseSchema,
  type AgentDetailResponse,
  type AgentPage,
  type AgentReputationResponse,
  type AgentsQuery,
} from '../../shared/schemas';
import { hashInputs, responseInputs, toInput } from './agentFeedback';
import { listFilters, orderBy, whereClause } from './agentQueries';
import {
  agentDetail,
  agentDetailRowSchema,
  listAgent,
  listAgentRowSchema,
  scatterResponses,
  scalesFromRows,
} from './agentRows';
import type { Sql } from './client';
import { feedbackRowSchema, responseRowSchema } from './rowSchemas';

const LIST_SELECT = `SELECT a.chain_id, a.token_id, a.name, a.description, a.image_url, a.owner,
    a.protocols, a.x402, s.score, s.ci_low, s.ci_high, s.confidence, s.unrated, s.raw_average,
    s.rated_rows, s.unique_wallets, s.feedback_count, a.registered_at
  FROM agents a
  LEFT JOIN agent_scores s ON s.chain_id = a.chain_id AND s.token_id = a.token_id`;

const DETAIL_SELECT = `SELECT a.chain_id, a.token_id, a.name, a.description, a.image_url, a.owner,
    a.agent_wallet, a.agent_uri, a.active, a.x402, a.protocols, a.supported_trust,
    a.services_json, a.version, a.registered_at, COALESCE(s.feedback_count, 0) AS feedback_count
  FROM agents a
  LEFT JOIN agent_scores s ON s.chain_id = a.chain_id AND s.token_id = a.token_id
  WHERE a.chain_id = $1 AND a.token_id = $2`;

const FEEDBACK = `SELECT f.chain_id, f.token_id, f.client_address, f.feedback_index, f.endpoint,
    f.feedback_uri, f.value_scaled, f.tag1, f.tag2, f.revoked, f.created_at, f.tx_hash
  FROM feedbacks f
  WHERE f.chain_id = $1 AND f.token_id = $2
  ORDER BY f.block_number, f.log_index`;

const RESPONSES = `SELECT chain_id, token_id, client_address, feedback_index, responder,
    response_uri, created_at, tx_hash
  FROM feedback_responses
  WHERE chain_id = $1 AND token_id = $2
  ORDER BY block_number, log_index`;

const SCALES = 'SELECT tag_key, scale, span FROM tag_scales WHERE chain_id = $1';

const SELF = 'SELECT owner, agent_wallet FROM agents WHERE chain_id = $1 AND token_id = $2';

const COUNT_ROW = z.array(z.object({ total: z.coerce.number() }));
const SELF_ROW = z.object({ owner: z.string().nullable(), agent_wallet: z.string().nullable() });

export type AgentStore = {
  listAgents(query: AgentsQuery): Promise<AgentPage>;
  getAgentDetail(chainId: number, tokenId: string): Promise<AgentDetailResponse | null>;
  getAgentReputation(chainId: number, tokenId: string): Promise<AgentReputationResponse | null>;
};

function isTestnet(chainId: number): boolean {
  return catalogChain(chainId)?.testnet ?? false;
}

type AgentEvidence = {
  feedback: object[];
  responses: object[];
  scales: ReturnType<typeof scalesFromRows>;
};

async function loadEvidence(db: Sql, chainId: number, tokenId: string): Promise<AgentEvidence> {
  const [feedback, responses, scaleRows] = await Promise.all([
    db.query(FEEDBACK, [chainId, tokenId]),
    db.query(RESPONSES, [chainId, tokenId]),
    db.query(SCALES, [chainId]),
  ]);

  return { feedback, responses, scales: scalesFromRows(scaleRows) };
}

async function listAgents(db: Sql, query: AgentsQuery): Promise<AgentPage> {
  const where = listFilters(query);
  const clause = whereClause(where);
  const page = query.page ?? 0;
  const pageSize = query.pageSize ?? 25;

  const [totals, rows] = await Promise.all([
    db.query(
      `SELECT COUNT(*)::int AS total FROM agents a LEFT JOIN agent_scores s
      ON s.chain_id = a.chain_id AND s.token_id = a.token_id ${clause}`,
      where.params
    ),
    db.query(
      `${LIST_SELECT} ${clause} ORDER BY ${orderBy(query)} LIMIT $${where.params.length + 1} OFFSET $${where.params.length + 2}`,
      [...where.params, pageSize + 1, page * pageSize]
    ),
  ]);

  const total = COUNT_ROW.parse(totals)[0]?.total ?? 0;

  const items = rows.slice(0, pageSize).map((row) => {
    const parsed = listAgentRowSchema.parse(row);

    return listAgent(parsed, isTestnet(parsed.chain_id));
  });

  return agentPageSchema.parse({ items, total, hasMore: rows.length > pageSize });
}

async function getAgentDetail(
  db: Sql,
  chainId: number,
  tokenId: string
): Promise<AgentDetailResponse | null> {
  const rows = await db.query(DETAIL_SELECT, [chainId, tokenId]);
  const row = rows[0];

  if (!row) return null;

  const evidence = await loadEvidence(db, chainId, tokenId);

  return agentDetailResponseSchema.parse(
    agentDetail({
      row: agentDetailRowSchema.parse(row),
      feedback: evidence.feedback.map((entry) => feedbackRowSchema.parse(entry)),
      responses: scatterResponses(evidence.responses),
      tagScales: evidence.scales.record,
      testnet: isTestnet(chainId),
    })
  );
}

async function getAgentReputation(
  db: Sql,
  chainId: number,
  tokenId: string
): Promise<AgentReputationResponse | null> {
  const selfRows = await db.query(SELF, [chainId, tokenId]);
  const selfRow = selfRows[0];

  if (!selfRow) return null;
  const self = SELF_ROW.parse(selfRow);

  const evidence = await loadEvidence(db, chainId, tokenId);
  const responders = responseInputs(evidence.responses.map((row) => responseRowSchema.parse(row)));

  const feedback = evidence.feedback.map((row) =>
    toInput(feedbackRowSchema.parse(row), responders)
  );

  const selves = [self.owner, self.agent_wallet].flatMap((address) => (address ? [address] : []));
  const now = Math.floor(Date.now() / 1000);

  const report = buildReputationReport(feedback, {
    self: selves,
    scales: evidence.scales.map,
    now,
  });

  const content = await hashEvidence(hashInputs(chainId, tokenId, feedback));

  return agentReputationResponseSchema.parse({
    chainId,
    tokenId,
    formulaVersion: report.formulaVersion,
    computedAt: now,
    contentHash: content.value,
    tagScales: evidence.scales.record,
    report: {
      score: report.score,
      interval: report.interval,
      confidence: report.confidence,
      unrated: report.unrated,
      raw: report.raw,
      rawRatings: report.rawRatings,
      inflation: report.inflation,
      cost: report.cost,
      funnel: report.funnel,
      concentration: report.concentration,
      contributions: report.contributions,
      waterfall: report.waterfall,
      counts: report.counts,
      byKind: report.byKind,
      telemetry: report.telemetry,
      findings: report.findings,
      responsiveness: report.responsiveness,
    },
  });
}

export function createAgentStore(db: Sql): AgentStore {
  return {
    listAgents: (query) => listAgents(db, query),
    getAgentDetail: (chainId, tokenId) => getAgentDetail(db, chainId, tokenId),
    getAgentReputation: (chainId, tokenId) => getAgentReputation(db, chainId, tokenId),
  };
}
