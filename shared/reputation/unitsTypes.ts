import type { Classified, TagProfile, TagScale } from './kinds';

/** One reviewer's reviews of one tag in one window collapse to a single unit. */
export const UNIT_WINDOW_DAYS = 30;

/** A unit's weight halves every this many days. */
export const HALF_LIFE_DAYS = 90;

export type RatingLayerOptions = {
  self?: readonly string[];
  now?: number;
  /** Days per rating unit; defaults to {@link UNIT_WINDOW_DAYS}. */
  unitWindowDays?: number;
  /** Days for a unit's weight to halve; defaults to {@link HALF_LIFE_DAYS}. */
  halfLifeDays?: number;
  /** Chain-wide tag scales; inferred from this agent's rows when omitted. */
  scales?: ReadonlyMap<string, TagScale>;
};

export type RatingUnit = {
  client: string;
  tag: string;
  /** Window number from the epoch, or `'undated'` when the row has no date. */
  bucket: number | 'undated';
  /** Median of the row ratings in the unit, in [0,1]. */
  r: number;
  /** Row indexes (into the feedback array) that formed the unit. */
  rows: number[];
  /** Days between the unit and "now"; 0 when undated. */
  ageDays: number;
  /** Time decay, in (0,1]. */
  time: number;
};

export type WalletRating = {
  client: string;
  units: RatingUnit[];
  /** Median of its units; what the wallet contributes. */
  r: number;
  /** min(1, Σ time) — one wallet can never hold more than one full vote. */
  weight: number;
  /** Rows behind its units. */
  rows: number;
};

export type KindCounts = {
  total: number;
  revoked: number;
  rating: number;
  outcome: number;
  telemetry: number;
  metric: number;
  unknown: number;
  /** Rating rows whose value fits no scale. */
  outOfScale: number;
  /** Rows from the agent's own owner/agent wallet. */
  self: number;
};

export type RatingLayer = {
  /** Parallel to the feedback array. */
  classified: Classified[];
  tags: TagProfile[];
  units: RatingUnit[];
  wallets: WalletRating[];
  counts: KindCounts;
};
