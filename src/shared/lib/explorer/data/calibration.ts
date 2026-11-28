import { buildReputationReport, type ReputationOptions } from './reputation/report';
import type { Confidence } from './reputation/score';
import type { Feedback } from './types';

export type CalibrationConfig = {
  id: string;
  label: string;
  options: ReputationOptions;
};

export type CalibrationAgent = { id: string; feedback: Feedback[] };

export type ScoreBand = 'trusted' | 'fair' | 'flagged';

export type CalibrationAgentScore = {
  id: string;
  score: number | null;
  confidence: Confidence;
  band: ScoreBand;
};

export type CalibrationResult = {
  config: CalibrationConfig;
  rows: CalibrationAgentScore[];
  trusted: number;
  fair: number;
  flagged: number;
  /** Spearman rank correlation against the first config; 1 for the baseline. */
  rho: number;
};

/** Score bands are a presentation choice, not part of the score. */
export function scoreBand(score: number | null, confidence: Confidence): ScoreBand {
  if (score === null) return 'flagged';
  if (score >= 70 && confidence !== 'low') return 'trusted';
  if (score >= 40) return 'fair';
  return 'flagged';
}

/** Average ranks, so tied scores do not invent an order. */
function ranks(values: readonly number[]): number[] {
  const order = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
  const out = new Array<number>(values.length).fill(0);
  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j + 1 < order.length && order[j + 1]!.value === order[i]!.value) j++;
    const rank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) out[order[k]!.index] = rank;
    i = j + 1;
  }
  return out;
}

/** Spearman's rank correlation; 1 when both series are constant. */
export function spearman(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length || a.length < 2) return 1;
  const ra = ranks(a);
  const rb = ranks(b);
  const mean = (a.length + 1) / 2;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < ra.length; i++) {
    const x = ra[i]! - mean;
    const y = rb[i]! - mean;
    num += x * y;
    da += x * x;
    db += y * y;
  }
  return da === 0 || db === 0 ? 1 : num / Math.sqrt(da * db);
}

function scoreAgents(
  agents: readonly CalibrationAgent[],
  options: ReputationOptions
): CalibrationAgentScore[] {
  return agents.map((agent) => {
    const report = buildReputationReport(agent.feedback, options);
    return {
      id: agent.id,
      score: report.score,
      confidence: report.confidence,
      band: scoreBand(report.score, report.confidence),
    };
  });
}

/**
 * Runs every config over the same agents and reports the tier counts plus the
 * rank correlation against the first config. The point is to show whether a
 * parameter choice changes the order or only the presentation.
 *
 * `now` defaults to the newest dated row across the input, so repeated runs
 * over the same export stay comparable. Pass a clock time to score a snapshot
 * as of today instead.
 */
export function calibrateAgents(
  agents: readonly CalibrationAgent[],
  configs: readonly CalibrationConfig[],
  opts: { now?: number } = {}
): CalibrationResult[] {
  const baseline = configs[0];
  if (!baseline) return [];
  const newest = agents
    .flatMap((agent) => agent.feedback.map((row) => row.createdAt))
    .filter((at): at is number => at !== undefined);
  const now = opts.now ?? (newest.length ? Math.max(...newest) : undefined);
  const withNow = (options: ReputationOptions): ReputationOptions =>
    now === undefined ? options : { ...options, now };
  const baselineScores = scoreAgents(agents, withNow(baseline.options)).map(
    (row) => row.score ?? 0
  );
  return configs.map((config) => {
    const rows = scoreAgents(agents, withNow(config.options));
    const values = rows.map((row) => row.score ?? 0);
    return {
      config,
      rows,
      trusted: rows.filter((row) => row.band === 'trusted').length,
      fair: rows.filter((row) => row.band === 'fair').length,
      flagged: rows.filter((row) => row.band === 'flagged').length,
      rho: config.id === baseline.id ? 1 : spearman(baselineScores, values),
    };
  });
}
