import type { Classified, Kind } from './kinds';
import { KIND_INFO } from './kinds';
import { DEFAULT_SCORE_PARAMS, filteredScore, type FilteredScore } from './score';
import { FORMULA_VERSION, KIND_ORDER } from './spec';
import type { FeedbackInput } from './types';
import {
  buildRatingLayer,
  HALF_LIFE_DAYS,
  UNIT_WINDOW_DAYS,
  type RatingLayer,
  type WalletRating,
} from './units';
import {
  burstOf,
  mean,
  pct,
  ratingIndexes,
  ratingValues,
  rawConcentration,
  responsivenessOf,
  sameTxShare,
  telemetryOf,
  type RawConcentration,
} from './analysis';
import { buildFindings } from './findings';
import { buildWaterfall } from './waterfall';
import type { ReputationOptions, ReputationReport, WalletContribution } from './reportTypes';

export type { ReputationOptions, ReputationReport } from './reportTypes';

function weightedMean(values: readonly number[], weights: readonly number[]): number | null {
  const total = weights.reduce((sum, weight) => sum + weight, 0);

  if (total <= 0) return null;

  return values.reduce((sum, value, index) => sum + value * (weights[index] ?? 0), 0) / total;
}

function top3(wallets: readonly WalletRating[], score: FilteredScore): number {
  const sorted = wallets.toSorted((a, b) => b.weight - a.weight);
  const top = sorted.slice(0, 3).reduce((sum, wallet) => sum + wallet.weight, 0);

  return top / (score.totalWeight || 1);
}

/** Exact leave-one-out posterior mean: no matrix or re-fit is needed. */
function contributionsOf(layer: RatingLayer, score: FilteredScore): WalletContribution[] {
  return layer.wallets
    .map((wallet) => {
      const share = score.totalWeight > 0 ? wallet.weight / score.totalWeight : 0;
      const denominator = score.alpha + score.beta - wallet.weight;

      const without =
        score.value !== null && denominator > 0
          ? (score.alpha - wallet.weight * wallet.r) / denominator
          : null;

      return {
        client: wallet.client,
        weight: wallet.weight,
        share,
        rating: wallet.r,
        without: without !== null && score.value !== null ? (without - score.value) * 100 : null,
      };
    })
    .toSorted((a, b) => b.weight - a.weight || b.share - a.share);
}

function byKindRows(
  feedback: readonly FeedbackInput[],
  classified: readonly Classified[]
): { kind: Kind; label: string; rows: number }[] {
  return KIND_ORDER.map((kind) => {
    let rows = 0;
    classified.forEach((row, index) => {
      const source = feedback[index];

      if (source && !source.revoked && row.kind === kind) rows++;
    });

    return { kind, label: KIND_INFO[kind].label, rows };
  });
}

function cappedMean(wallets: readonly WalletRating[]): number | null {
  return weightedMean(
    wallets.map((wallet) => wallet.r),
    wallets.map((wallet) => wallet.weight)
  );
}

function paramsOf(opts: ReputationOptions): ReputationReport['params'] {
  return {
    unitWindowDays: opts.unitWindowDays ?? UNIT_WINDOW_DAYS,
    halfLifeDays: opts.halfLifeDays ?? HALF_LIFE_DAYS,
    alpha0: opts.alpha0 ?? DEFAULT_SCORE_PARAMS.alpha0,
    mu0: opts.mu0 ?? DEFAULT_SCORE_PARAMS.mu0,
    fakeTarget: opts.fakeTarget ?? DEFAULT_SCORE_PARAMS.target,
  };
}

function concentrationOf(
  layer: RatingLayer,
  score: FilteredScore,
  raw: RawConcentration
): ReputationReport['concentration'] {
  return {
    top1: score.top1,
    top3: top3(layer.wallets, score),
    neff: score.neff,
    maxInfluence: score.maxInfluence,
    rawTop1: raw.rawTop1,
    rawTop3: raw.rawTop3,
    rawNeff: raw.rawNeff,
  };
}

/**
 * The whole classic reputation view from one pass: kinds, rating units,
 * wallet caps, filtered score, inflation gap, funnel, concentration, telemetry.
 * Every number is re-derivable from the rows the page already holds.
 */
export function buildReputationReport(
  feedback: FeedbackInput[],
  opts: ReputationOptions = {}
): ReputationReport {
  const params = paramsOf(opts);
  const layer = buildRatingLayer(feedback, opts);

  const score = filteredScore(layer.wallets, {
    alpha0: params.alpha0,
    mu0: params.mu0,
    target: params.fakeTarget,
  });

  const selves = new Set((opts.self ?? []).map((address) => address.toLowerCase()));
  const valid = feedback.filter((row) => !row.revoked);
  const rawAll = mean(feedback.map((row) => row.value));
  const raw = mean(valid.map((row) => row.value));
  const rawRatings = mean(ratingValues(feedback, layer.classified, false, selves));
  const rawRatingsAll = mean(ratingValues(feedback, layer.classified, true, selves));
  const allRatingCount = ratingValues(feedback, layer.classified, true, selves).length;
  const ratingIdx = ratingIndexes(feedback, layer.classified, selves);

  const inflation =
    rawRatings !== null && score.value !== null ? (rawRatings - score.value) * 100 : null;

  const walletsAfterCap = layer.wallets.filter((wallet) => wallet.weight > 0).length;
  const unitMean = mean(layer.units.map((unit) => unit.r));
  const burst = burstOf(feedback, ratingIdx);
  const txShare = sameTxShare(feedback, ratingIdx);
  const rawConc = rawConcentration(feedback, ratingIdx);

  return {
    formulaVersion: FORMULA_VERSION,
    params,
    score: pct(score.value),
    interval: score.interval ? [score.interval[0] * 100, score.interval[1] * 100] : null,
    confidence: score.confidence,
    unrated: score.unrated,
    raw,
    rawRatings: pct(rawRatings),
    inflation,
    cost: score.cost,
    funnel: {
      feedback: feedback.length,
      ratedRows: layer.units.reduce((sum, unit) => sum + unit.rows.length, 0),
      wallets: layer.wallets.length,
      units: layer.units.length,
      walletsAfterCap,
    },
    concentration: concentrationOf(layer, score, rawConc),
    contributions: contributionsOf(layer, score),
    burst: { maxDayRows: burst.maxDayRows, activeDays: burst.activeDays, ratio: burst.ratio },
    sameTxShare: txShare,
    counts: layer.counts,
    byKind: byKindRows(feedback, layer.classified),
    telemetry: telemetryOf(feedback, layer.classified),
    findings: buildFindings({
      feedback,
      classified: layer.classified,
      ratingIdx,
      counts: layer.counts,
      burst,
      sameTxShare: txShare,
    }),
    responsiveness: responsivenessOf(feedback, layer.classified, ratingIdx, opts.self ?? []),
    layer,
    waterfall: buildWaterfall({
      rawAll,
      feedbackCount: feedback.length,
      raw,
      validCount: valid.length,
      rawRatingsAll: pct(rawRatingsAll),
      allRatingCount,
      rawRatings: pct(rawRatings),
      ratingCount: rawRatings === null ? 0 : ratingIdx.length,
      unitMean: pct(unitMean),
      capped: pct(cappedMean(layer.wallets)),
      walletsAfterCap,
      score: score.unrated ? null : pct(score.value),
    }),
  };
}
