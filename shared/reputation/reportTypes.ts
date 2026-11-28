import type { Kind, TagScale } from './kinds';
import type { Confidence } from './score';
import { FORMULA_VERSION } from './spec';
import type { RatingLayer } from './units';
import type { Responsiveness, TelemetrySummary } from './analysis';
import type { Finding } from './findings';
import type { ReportStep } from './waterfall';

export type ReputationOptions = {
  self?: readonly string[];
  now?: number;
  /** Prior strength in wallet units; defaults to 3. */
  alpha0?: number;
  /** Neutral prior mean; defaults to 0.5. */
  mu0?: number;
  /** Days for a unit's weight to halve; defaults to 90. */
  halfLifeDays?: number;
  /** Days per rating unit; defaults to 30. */
  unitWindowDays?: number;
  /** Target a faker aims for when pricing a fake; defaults to 0.9. */
  fakeTarget?: number;
  /** Chain-wide tag scales; inferred from this agent's rows when omitted. */
  scales?: ReadonlyMap<string, TagScale>;
};

/** One reviewer wallet's actual pull on the filtered score. */
export type WalletContribution = {
  client: string;
  /** Capped wallet weight, in full votes. */
  weight: number;
  /** Share of the total wallet weight. */
  share: number;
  /** Normalised wallet rating, 0–1. */
  rating: number;
  /** Filtered score without this wallet minus with it, in 0–100 points. */
  without: number | null;
};

export type ReputationReport = {
  formulaVersion: typeof FORMULA_VERSION;
  params: {
    unitWindowDays: number;
    halfLifeDays: number;
    alpha0: number;
    mu0: number;
    fakeTarget: number;
  };
  /** 0–100 filtered score; null when the agent has no rating units. */
  score: number | null;
  /** 80% Beta interval, 0–100. */
  interval: [number, number] | null;
  confidence: Confidence;
  unrated: boolean;
  /** Plain mean of every non-revoked row, 0–100 (the registry's raw number). */
  raw: number | null;
  /** Plain mean of the normalised rating rows only (excluding self-reviews), 0–100. */
  rawRatings: number | null;
  /** rawRatings − score. Large positive = the rules removed inflation. */
  inflation: number | null;
  /** Fresh unlinked wallets needed to force the score to the fake target. */
  cost: number | null;
  funnel: {
    feedback: number;
    ratedRows: number;
    wallets: number;
    units: number;
    walletsAfterCap: number;
  };
  concentration: {
    top1: number;
    top3: number;
    neff: number;
    maxInfluence: number;
    /** The same three numbers before unit collapsing, one row = one vote. */
    rawTop1: number;
    rawTop3: number;
    rawNeff: number;
  };
  /** Per-wallet shares and leave-one-out pull on the filtered score. */
  contributions: WalletContribution[];
  /** Ratings per calendar day: the busiest day and how far it stands out. */
  burst: { maxDayRows: number; activeDays: number; ratio: number | null };
  /** Share of rating rows that share a transaction with another rating row. */
  sameTxShare: number | null;
  counts: RatingLayer['counts'];
  byKind: { kind: Kind; label: string; rows: number }[];
  /** Non-rating rows grouped by tag, the telemetry panel. */
  telemetry: TelemetrySummary[];
  findings: Finding[];
  responsiveness: Responsiveness;
  layer: RatingLayer;
  waterfall: ReportStep[];
};
