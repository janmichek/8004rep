import { z } from 'zod';
import { scatterResponses } from './agentRows';
import type { ReputationReport, TagScale } from '../../shared/reputation';
import type { ScorableAgent, ScoreFeedbackRow, ScorerStore } from '../indexer/scorer';
import type { Sql } from './client';
import { agentRowSchema, feedbackRowSchema, selfRowSchema } from './rowSchemas';

const CHAIN_FEEDBACK = `SELECT f.chain_id, f.token_id, f.client_address, f.feedback_index, f.endpoint,
    f.feedback_uri, f.value_scaled, f.tag1, f.tag2, f.revoked, f.created_at, f.tx_hash,
    a.owner, a.agent_wallet
  FROM feedbacks f
  JOIN agents a ON a.chain_id = f.chain_id AND a.token_id = f.token_id
  WHERE f.chain_id = $1`;

const AGENT_FEEDBACK = `${CHAIN_FEEDBACK} AND f.token_id = $2`;

const RESPONSES = `SELECT chain_id, token_id, client_address, feedback_index, responder,
    response_uri, created_at, tx_hash
  FROM feedback_responses
  WHERE chain_id = $1 AND token_id = $2
  ORDER BY block_number, log_index`;

const DIRTY_AGENTS = `SELECT chain_id, token_id, owner, agent_wallet
  FROM agents
  WHERE chain_id = $1 AND score_dirty = TRUE
  ORDER BY token_id
  LIMIT $2`;

const STALE_AGENTS = `SELECT a.chain_id, a.token_id, a.owner, a.agent_wallet
  FROM agent_scores s
  JOIN agents a ON a.chain_id = s.chain_id AND a.token_id = s.token_id
  WHERE s.scored_at < NOW() - INTERVAL '24 hours' AND s.feedback_count > 0
  ORDER BY s.scored_at
  LIMIT $1`;

const UPSERT_SCORE = `INSERT INTO agent_scores
  (chain_id, token_id, formula_version, score, ci_low, ci_high, confidence, unrated,
   raw_average, raw_ratings_average, inflation, feedback_count, rated_rows, unique_wallets,
   rating_units, total_weight, neff, top1_share, cost_to_fake, scored_at)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19,
    to_timestamp($20))
  ON CONFLICT (chain_id, token_id) DO UPDATE
    SET formula_version = EXCLUDED.formula_version,
        score = EXCLUDED.score, ci_low = EXCLUDED.ci_low, ci_high = EXCLUDED.ci_high,
        confidence = EXCLUDED.confidence, unrated = EXCLUDED.unrated,
        raw_average = EXCLUDED.raw_average, raw_ratings_average = EXCLUDED.raw_ratings_average,
        inflation = EXCLUDED.inflation, feedback_count = EXCLUDED.feedback_count,
        rated_rows = EXCLUDED.rated_rows, unique_wallets = EXCLUDED.unique_wallets,
        rating_units = EXCLUDED.rating_units, total_weight = EXCLUDED.total_weight,
        neff = EXCLUDED.neff, top1_share = EXCLUDED.top1_share,
        cost_to_fake = EXCLUDED.cost_to_fake, scored_at = EXCLUDED.scored_at`;

function feedbackRow(parsed: z.infer<typeof feedbackRowSchema>): ScoreFeedbackRow {
  return {
    chainId: parsed.chain_id,
    tokenId: parsed.token_id,
    client: parsed.client_address,
    feedbackIndex: parsed.feedback_index.toString(),
    endpoint: parsed.endpoint,
    feedbackUri: parsed.feedback_uri,
    value: parsed.value_scaled,
    tag1: parsed.tag1,
    tag2: parsed.tag2,
    revoked: parsed.revoked,
    createdAt: Number(parsed.created_at),
    txHash: parsed.tx_hash,
    responses: [],
  };
}

async function chainFeedback(
  db: Sql,
  chainId: number
): Promise<(ScoreFeedbackRow & { owner: string | null; agentWallet: string | null })[]> {
  const rows = await db.query(CHAIN_FEEDBACK, [chainId]);

  return rows.map((row) => {
    const self = selfRowSchema.parse(row);

    return {
      ...feedbackRow(feedbackRowSchema.parse(row)),
      owner: self.owner,
      agentWallet: self.agent_wallet,
    };
  });
}

async function feedbackForAgent(
  db: Sql,
  chainId: number,
  tokenId: string
): Promise<ScoreFeedbackRow[]> {
  const [rows, responses] = await Promise.all([
    db.query(AGENT_FEEDBACK, [chainId, tokenId]),
    db.query(RESPONSES, [chainId, tokenId]),
  ]);

  const byFeedback = scatterResponses(responses);

  return rows.map((row) => {
    const mapped = feedbackRow(feedbackRowSchema.parse(row));
    const key = `${mapped.client}|${mapped.feedbackIndex}`;

    return { ...mapped, responses: byFeedback.get(key) ?? [] };
  });
}

function agentFromRow(parsed: z.infer<typeof agentRowSchema>): ScorableAgent {
  return {
    chainId: parsed.chain_id,
    tokenId: parsed.token_id,
    owner: parsed.owner,
    agentWallet: parsed.agent_wallet,
  };
}

function scoreParams(
  chainId: number,
  tokenId: string,
  report: ReputationReport,
  scoredAt: number
): (string | number | boolean | null)[] {
  return [
    chainId,
    tokenId,
    report.formulaVersion,
    report.score,
    report.interval?.[0] ?? null,
    report.interval?.[1] ?? null,
    report.confidence,
    report.unrated,
    report.raw,
    report.rawRatings,
    report.inflation,
    report.funnel.feedback,
    report.funnel.ratedRows,
    report.funnel.wallets,
    report.funnel.units,
    report.layer.wallets.reduce((sum, wallet) => sum + wallet.weight, 0),
    report.concentration.neff,
    report.concentration.top1,
    report.cost,
    scoredAt,
  ];
}

export function createScorerStore(db: Sql): ScorerStore {
  return {
    async chainsWithDirtyAgents(): Promise<number[]> {
      const rows = await db.query('SELECT DISTINCT chain_id FROM agents WHERE score_dirty = TRUE');
      const parsed = z.array(z.object({ chain_id: z.coerce.number() })).parse(rows);

      return parsed.map((row) => row.chain_id);
    },

    chainFeedback: (chainId) => chainFeedback(db, chainId),

    async dirtyAgents(chainId, limit): Promise<ScorableAgent[]> {
      const rows = await db.query(DIRTY_AGENTS, [chainId, limit]);

      return rows.map((row) => agentFromRow(agentRowSchema.parse(row)));
    },

    feedbackForAgent: (chainId, tokenId) => feedbackForAgent(db, chainId, tokenId),

    async saveTagScales(chainId: number, scales: ReadonlyMap<string, TagScale>): Promise<void> {
      await db.transaction(async (tx) => {
        await tx.query('DELETE FROM tag_scales WHERE chain_id = $1', [chainId]);

        for (const [tag, scale] of scales) {
          await tx.query(
            `INSERT INTO tag_scales (chain_id, tag_key, scale, span, sample_count, updated_at)
             VALUES ($1, $2, $3, $4, 0, NOW())`,
            [chainId, tag, scale.scale, scale.span]
          );
        }
      });
    },

    async saveScore(chainId, tokenId, report, scoredAt): Promise<void> {
      await db.query(UPSERT_SCORE, scoreParams(chainId, tokenId, report, scoredAt));
    },

    async clearDirty(chainId, tokenId): Promise<void> {
      await db.query(
        'UPDATE agents SET score_dirty = FALSE WHERE chain_id = $1 AND token_id = $2',
        [chainId, tokenId]
      );
    },

    async staleAgents(limit): Promise<ScorableAgent[]> {
      const rows = await db.query(STALE_AGENTS, [limit]);

      return rows.map((row) => agentFromRow(agentRowSchema.parse(row)));
    },
  };
}
