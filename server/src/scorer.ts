import type { Address } from 'viem'
import { computeFeedbackStats } from '../../src/data/feedbackStats'
import { computeNetworkStats } from '../../src/data/networkStats'
import { FORMULA_VERSION, buildReputationReport } from '../../src/data/reputation/report'
import { buildTrustReport } from '../../src/data/trustReport'
import type { FeedbackEvent } from '../../src/data/types'
import { SCORE_BATCH } from './config'
import { all, get, run, transaction } from './db'
import { feedbackOfRows, parseJson, type AgentRow, type FeedbackRow, type ResponseRow, type ScoreRow } from './rows'

export type Scored = {
  report: ReturnType<typeof buildReputationReport>
  stats: ReturnType<typeof computeFeedbackStats>
  trust: ReturnType<typeof buildTrustReport>
}

function feedbackOf(chainId: number, tokenId: string) {
  const rows = all<FeedbackRow>(
    `SELECT * FROM feedback WHERE chain_id = ? AND token_id = ?
     ORDER BY COALESCE(created_at, 0) DESC, feedback_index DESC`,
    chainId,
    tokenId,
  )
  const responses = all<ResponseRow>('SELECT * FROM feedback_responses WHERE chain_id = ? AND token_id = ?', chainId, tokenId)
  return { rows, feedback: feedbackOfRows(rows, responses) }
}

function scoreOne(agent: AgentRow): Scored | null {
  const { rows, feedback } = feedbackOf(agent.chain_id, agent.token_id)
  const self = [agent.owner, agent.agent_wallet].filter((value): value is string => Boolean(value))
  const services = parseJson<{ endpoint: string }[]>(agent.services_json, []).map((service) => service.endpoint)
  const report = buildReputationReport(feedback, { self })
  const stats = computeFeedbackStats(feedback, {
    owner: agent.owner as Address | null,
    agentWallet: agent.agent_wallet as Address | null,
    services,
  })
  const trust = buildTrustReport(feedback, stats, self)
  const now = Math.floor(Date.now() / 1000)
  const evidence = rows.length ? rows.filter((row) => row.tx_hash || row.feedback_uri).length / rows.length : 0
  run(
    `INSERT INTO agent_scores (chain_id, token_id, formula_version, filtered_score, interval_lo, interval_hi,
       confidence, unrated, raw_score, raw_ratings, inflation_gap, cost_to_fake, total_feedback, rated_rows,
       wallets_count, entities_count, neff, top1, risk_level, evidence_backed_share,
       report_json, stats_json, trust_report_json, computed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(chain_id, token_id) DO UPDATE SET
       formula_version = excluded.formula_version,
       filtered_score = excluded.filtered_score,
       interval_lo = excluded.interval_lo,
       interval_hi = excluded.interval_hi,
       confidence = excluded.confidence,
       unrated = excluded.unrated,
       raw_score = excluded.raw_score,
       raw_ratings = excluded.raw_ratings,
       inflation_gap = excluded.inflation_gap,
       cost_to_fake = excluded.cost_to_fake,
       total_feedback = excluded.total_feedback,
       rated_rows = excluded.rated_rows,
       wallets_count = excluded.wallets_count,
       neff = excluded.neff,
       top1 = excluded.top1,
       risk_level = excluded.risk_level,
       evidence_backed_share = excluded.evidence_backed_share,
       report_json = excluded.report_json,
       stats_json = excluded.stats_json,
       trust_report_json = excluded.trust_report_json,
       computed_at = excluded.computed_at`,
    agent.chain_id,
    agent.token_id,
    FORMULA_VERSION,
    report.score,
    report.interval?.[0] ?? null,
    report.interval?.[1] ?? null,
    report.confidence,
    report.unrated ? 1 : 0,
    report.raw,
    report.rawRatings,
    report.inflation,
    report.cost,
    rows.length,
    report.funnel.ratedRows,
    report.funnel.wallets,
    report.concentration.neff,
    report.concentration.top1,
    stats.level,
    evidence,
    JSON.stringify(report),
    JSON.stringify(stats),
    JSON.stringify(trust),
    now,
  )
  run(
    'UPDATE agents SET needs_recompute = 0, score_attempts = 0, score_next_try_at = NULL WHERE chain_id = ? AND token_id = ?',
    agent.chain_id,
    agent.token_id,
  )
  return { report, stats, trust }
}

export function scoreAgent(chainId: number, tokenId: string): Scored | null {
  const agent = get<AgentRow>('SELECT * FROM agents WHERE chain_id = ? AND token_id = ?', chainId, tokenId)
  if (!agent) return null
  return scoreOne(agent)
}

export function scoreDirty(limit = SCORE_BATCH): number {
  const now = Math.floor(Date.now() / 1000)
  const rows = all<AgentRow>(
    `SELECT * FROM agents WHERE needs_recompute = 1
       AND (score_next_try_at IS NULL OR score_next_try_at <= ?)
     ORDER BY score_attempts ASC, COALESCE(created_at, 0) DESC LIMIT ?`,
    now,
    limit,
  )
  if (!rows.length) return 0
  let done = 0
  transaction(() => {
    for (const agent of rows) {
      try {
        scoreOne(agent)
        done++
      } catch (error) {
        console.error(`[score] ${agent.chain_id}:${agent.token_id}: ${error instanceof Error ? error.message : String(error)}`)
        // Keep needs_recompute = 1, but back off so one permanently broken
        // agent cannot monopolise every pass.
        run(
          'UPDATE agents SET score_attempts = score_attempts + 1, score_next_try_at = ? WHERE chain_id = ? AND token_id = ?',
          Math.floor(Date.now() / 1000) + Math.min(6 * 3600, 300 * 2 ** Math.min(agent.score_attempts, 8)),
          agent.chain_id,
          agent.token_id,
        )
      }
    }
  })
  return done
}

export function scoreJson(chainId: number, tokenId: string): ScoreRow | undefined {
  return get<ScoreRow>('SELECT * FROM agent_scores WHERE chain_id = ? AND token_id = ?', chainId, tokenId)
}

const SNAPSHOT_TTL_SECONDS = 600
/** Bound the quadratic reviewer-overlap pass so one recompute cannot freeze the process. */
const SNAPSHOT_AGENTS = 300
const SNAPSHOT_ROWS = 20_000
const snapshotInFlight = new Set<number>()

type SnapshotRow = {
  chain_id: number
  token_id: string
  client: string
  feedback_index: number
  value: number
  tag1: string | null
  tag2: string | null
  endpoint: string | null
  feedback_uri: string | null
  revoked: number
  created_at: number | null
  tx_hash: string | null
  owner: string | null
  name: string | null
}

/** The expensive part; only ever called from a scheduled background task. */
function recomputeNetworkSnapshot(chainId: number): void {
  const rows = all<SnapshotRow>(
    `SELECT f.chain_id, f.token_id, f.client, f.feedback_index, f.value, f.tag1, f.tag2, f.endpoint,
       f.feedback_uri, f.revoked, f.created_at, f.tx_hash, a.owner, a.name
     FROM feedback f LEFT JOIN agents a ON a.chain_id = f.chain_id AND a.token_id = f.token_id
     WHERE f.chain_id = ? ORDER BY COALESCE(f.created_at, 0) DESC LIMIT ?`,
    chainId,
    SNAPSHOT_ROWS,
  )
  const events: FeedbackEvent[] = rows.map((row) => ({
    chainId: row.chain_id,
    tokenId: BigInt(row.token_id),
    client: row.client as Address,
    index: row.feedback_index,
    value: row.value,
    ...(row.tag1 ? { tag1: row.tag1 } : {}),
    ...(row.tag2 ? { tag2: row.tag2 } : {}),
    ...(row.endpoint ? { endpoint: row.endpoint } : {}),
    ...(row.feedback_uri ? { feedbackURI: row.feedback_uri } : {}),
    revoked: row.revoked === 1,
    ...(row.created_at ? { createdAt: row.created_at } : {}),
    ...(row.tx_hash ? { txHash: row.tx_hash as `0x${string}` } : {}),
    ...(row.owner ? { agentOwner: row.owner as Address } : {}),
    ...(row.name ? { agentName: row.name } : {}),
  }))
  // Keep every row for aggregates; only the quadratic lookalike pass is capped.
  const stats = computeNetworkStats(events, 12, { lookalikeAgentLimit: SNAPSHOT_AGENTS })
  const computedAt = Math.floor(Date.now() / 1000)
  run(
    `INSERT INTO network_snapshots (chain_id, window_key, stats_json, computed_at) VALUES (?, 'all', ?, ?)
     ON CONFLICT(chain_id, window_key) DO UPDATE SET stats_json = excluded.stats_json, computed_at = excluded.computed_at`,
    chainId,
    JSON.stringify(stats, (_key, value) => (typeof value === 'bigint' ? value.toString() : value)),
    computedAt,
  )
}

function scheduleSnapshot(chainId: number): void {
  if (snapshotInFlight.has(chainId)) return
  snapshotInFlight.add(chainId)
  // Let the HTTP response leave first; the API keeps serving the previous
  // snapshot while this runs.
  setImmediate(() => {
    try {
      recomputeNetworkSnapshot(chainId)
    } catch (error) {
      console.error(`[network] ${chainId}: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      snapshotInFlight.delete(chainId)
    }
  })
}

export function networkSnapshot(chainId: number): Record<string, unknown> | null {
  const cached = get<{ stats_json: string; computed_at: number }>(
    'SELECT stats_json, computed_at FROM network_snapshots WHERE chain_id = ? AND window_key = ?',
    chainId,
    'all',
  )
  const fresh = cached !== undefined && Date.now() / 1000 - cached.computed_at < SNAPSHOT_TTL_SECONDS
  if (cached) {
    if (!fresh) scheduleSnapshot(chainId)
    return {
      ...parseJson<Record<string, unknown>>(cached.stats_json, {}),
      computedAt: cached.computed_at,
      ...(fresh ? {} : { stale: true, recomputing: true }),
    }
  }
  // No snapshot yet: compute a bounded first one so the first visitor gets
  // data. Later refreshes use the stale-while-revalidate path above.
  try {
    recomputeNetworkSnapshot(chainId)
    const saved = get<{ stats_json: string; computed_at: number }>(
      'SELECT stats_json, computed_at FROM network_snapshots WHERE chain_id = ? AND window_key = ?',
      chainId,
      'all',
    )
    if (saved) return { ...parseJson<Record<string, unknown>>(saved.stats_json, {}), computedAt: saved.computed_at }
  } catch (error) {
    console.error(`[network] ${chainId}: ${error instanceof Error ? error.message : String(error)}`)
  }
  return { rows: 0, agents: 0, reviewers: 0, average: null, ratingValues: [], perfectShare: null, revoked: 0, topAgents: [], suspects: [], lookalikes: [] }
}
