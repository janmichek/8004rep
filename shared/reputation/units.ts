import type { FeedbackInput } from './types';
import { classify, inferTagScales, type Classified, type Kind } from './kinds';
import { HALF_LIFE_DAYS, UNIT_WINDOW_DAYS } from './unitsTypes';
import type {
  KindCounts,
  RatingLayer,
  RatingLayerOptions,
  RatingUnit,
  WalletRating,
} from './unitsTypes';

export {
  HALF_LIFE_DAYS,
  UNIT_WINDOW_DAYS,
  type KindCounts,
  type RatingLayer,
  type RatingLayerOptions,
  type WalletRating,
} from './unitsTypes';

const DAY = 86400;

export function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = xs.toSorted((a, b) => a - b);
  const mid = Math.floor(s.length / 2);

  return s.length % 2 ? (s[mid] ?? 0) : ((s[mid - 1] ?? 0) + (s[mid] ?? 0)) / 2;
}

type Settings = { unitWindowDays: number; halfLifeDays: number; now: number };

type UnitDraft = { unit: RatingUnit; ratings: number[]; times: number[] };

type LayerContext = {
  classified: readonly Classified[];
  selves: ReadonlySet<string>;
  counts: KindCounts;
  settings: Settings;
};

function settingsFrom(opts: RatingLayerOptions): Settings {
  return {
    unitWindowDays: opts.unitWindowDays ?? UNIT_WINDOW_DAYS,
    halfLifeDays: opts.halfLifeDays ?? HALF_LIFE_DAYS,
    now: opts.now ?? Math.floor(Date.now() / 1000),
  };
}

function emptyCounts(total: number): KindCounts {
  return {
    total,
    revoked: 0,
    rating: 0,
    outcome: 0,
    telemetry: 0,
    metric: 0,
    unknown: 0,
    outOfScale: 0,
    self: 0,
  };
}

function bucketOf(feedback: FeedbackInput, unitWindowDays: number): number | 'undated' {
  return feedback.createdAt === undefined
    ? 'undated'
    : Math.floor(feedback.createdAt / (unitWindowDays * DAY));
}

/** Counts the row and returns its rating when it becomes a unit. */
function disposeRow(
  context: LayerContext,
  classified: Classified,
  feedback: FeedbackInput
): number | null {
  if (feedback.revoked) {
    context.counts.revoked++;

    return null;
  }

  if (context.selves.has(feedback.client.toLowerCase())) {
    context.counts.self++;

    return null;
  }

  const kind: Kind = classified.kind;
  context.counts[kind]++;

  if (kind !== 'rating') return null;

  if (classified.r === null) {
    context.counts.outOfScale++;

    return null;
  }

  return classified.r;
}

const UNCLASSIFIED: Classified = { kind: 'unknown', tag: '', scale: 'unbounded', span: 0, r: null };

type AddRowArgs = {
  feedback: FeedbackInput;
  classified: Classified;
  rating: number;
  index: number;
  byKey: Map<string, UnitDraft>;
  units: UnitDraft[];
  unitWindowDays: number;
};

function addRow(args: AddRowArgs): void {
  const { feedback, classified, rating, index, byKey, units, unitWindowDays } = args;
  const bucket = bucketOf(feedback, unitWindowDays);
  const key = `${feedback.client.toLowerCase()}|${classified.tag}|${bucket}`;
  let hit = byKey.get(key);

  if (!hit) {
    hit = {
      unit: {
        client: feedback.client,
        tag: classified.tag,
        bucket,
        r: rating,
        rows: [],
        ageDays: 0,
        time: 1,
      },
      ratings: [],
      times: [],
    };
    byKey.set(key, hit);
    units.push(hit);
  }

  hit.ratings.push(rating);
  hit.unit.rows.push(index);

  if (feedback.createdAt !== undefined) hit.times.push(feedback.createdAt);
}

function finalizeUnit(draft: UnitDraft, settings: Settings): void {
  draft.unit.r = median(draft.ratings) ?? draft.unit.r;
  // A unit covers one window; its timestamp is the median row time, so decay
  // does not depend on the order the rows arrived in.
  const at = median(draft.times);

  if (at === null) return;
  draft.unit.ageDays = Math.max(0, (settings.now - at) / DAY);
  draft.unit.time = 2 ** (-draft.unit.ageDays / settings.halfLifeDays);
}

function buildWallets(units: readonly RatingUnit[]): WalletRating[] {
  const byClient = new Map<string, WalletRating>();

  for (const unit of units) {
    const key = unit.client.toLowerCase();
    let wallet = byClient.get(key);

    if (!wallet) {
      wallet = { client: unit.client, units: [], r: 0, weight: 0, rows: 0 };
      byClient.set(key, wallet);
    }

    wallet.units.push(unit);
    wallet.rows += unit.rows.length;
  }

  const wallets = [...byClient.values()].map((wallet) => ({
    ...wallet,
    r: median(wallet.units.map((unit) => unit.r)) ?? 0,
    weight: Math.min(
      1,
      wallet.units.reduce((sum, unit) => sum + unit.time, 0)
    ),
  }));

  return wallets.toSorted((a, b) => b.weight - a.weight || b.rows - a.rows);
}

/**
 * Rows → kinds → rating units → one aggregate per wallet. Only RATING rows
 * enter: latency, uptime, revenue, pass flags and unknown tags are counted and
 * shown, never averaged into the score.
 */
export function buildRatingLayer(
  feedback: FeedbackInput[],
  opts: RatingLayerOptions = {}
): RatingLayer {
  const settings = settingsFrom(opts);
  const selves = new Set((opts.self ?? []).map((address) => address.toLowerCase()));

  // Infer scales from rows that can actually be scored. A self-review must not
  // redefine the tag's scale and change every other wallet's normalized rating.
  const scaleRows = feedback.filter((row) => !row.revoked && !selves.has(row.client.toLowerCase()));

  const scales = opts.scales ?? inferTagScales(scaleRows);
  const { rows: classified, tags } = classify(feedback, { scales });

  const context: LayerContext = {
    classified,
    selves,
    counts: emptyCounts(feedback.length),
    settings,
  };

  const units: RatingUnit[] = [];
  const drafts: UnitDraft[] = [];
  const byKey = new Map<string, UnitDraft>();

  for (const [index, feedbackRow] of feedback.entries()) {
    const row = classified[index] ?? UNCLASSIFIED;
    const rating = disposeRow(context, row, feedbackRow);

    if (rating === null) continue;

    addRow({
      feedback: feedbackRow,
      classified: row,
      rating,
      index,
      byKey,
      units: drafts,
      unitWindowDays: settings.unitWindowDays,
    });
  }

  for (const draft of drafts) {
    finalizeUnit(draft, settings);
    units.push(draft.unit);
  }

  return {
    classified,
    tags,
    units,
    wallets: buildWallets(units),
    counts: context.counts,
  };
}
