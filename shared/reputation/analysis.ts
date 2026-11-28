import type { Classified } from './kinds';
import { median } from './units';
import type { FeedbackInput } from './types';

export type { TelemetrySummary } from './telemetry';

export { telemetryOf } from './telemetry';

export type Responsiveness = {
  /** Ratings at or below half of their scale. */
  lowRatings: number;
  /** How many of those carry at least one response. */
  responded: number;
  share: number | null;
  medianLagDays: number | null;
  /** Responses from the owner, agent wallet or someone else. */
  ownerReplies: number;
  thirdPartyReplies: number;
};

export type Burst = {
  maxDayRows: number;
  activeDays: number;
  ratio: number | null;
  datedRows: number;
};

export type RawConcentration = {
  rawTop1: number;
  rawTop3: number;
  rawNeff: number;
};

export function mean(xs: readonly number[]): number | null {
  return xs.length ? xs.reduce((sum, value) => sum + value, 0) / xs.length : null;
}

export function pct(x: number | null): number | null {
  return x === null ? null : x * 100;
}

/** Whether a row is a scorable rating; self-reviews are excluded unless asked for. */
function isRating(feedback: FeedbackInput, classified: Classified, selves: ReadonlySet<string>) {
  return (
    !feedback.revoked &&
    classified.kind === 'rating' &&
    classified.r !== null &&
    !selves.has(feedback.client.toLowerCase())
  );
}

/** Indexes of rows that enter the filtered score. */
export function ratingIndexes(
  feedback: readonly FeedbackInput[],
  classified: readonly Classified[],
  selves: ReadonlySet<string>
): number[] {
  const out: number[] = [];
  classified.forEach((row, index) => {
    const source = feedback[index];

    if (source && isRating(source, row, selves)) out.push(index);
  });

  return out;
}

/** Normalised rating values, optionally keeping self-reviews. */
export function ratingValues(
  feedback: readonly FeedbackInput[],
  classified: readonly Classified[],
  keepSelf: boolean,
  selves: ReadonlySet<string>
): number[] {
  const out: number[] = [];
  classified.forEach((row, index) => {
    const source = feedback[index];

    if (!source || source.revoked || row.kind !== 'rating' || row.r === null) return;

    if (!keepSelf && selves.has(source.client.toLowerCase())) return;
    out.push(row.r);
  });

  return out;
}

export function burstOf(feedback: readonly FeedbackInput[], ratingIdx: readonly number[]): Burst {
  const perDay = new Map<number, number>();
  let dated = 0;

  for (const index of ratingIdx) {
    const at = feedback[index]?.createdAt;

    if (at === undefined) continue;
    dated++;
    const day = Math.floor(at / 86400);
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
  }

  const maxDayRows = Math.max(0, ...perDay.values());
  const activeDays = perDay.size;
  const ratio = activeDays > 1 && dated >= 10 ? maxDayRows / (dated / activeDays) : null;

  return { maxDayRows, activeDays, ratio, datedRows: dated };
}

/** Share of rating rows that share a transaction with another rating row. */
export function sameTxShare(
  feedback: readonly FeedbackInput[],
  ratingIdx: readonly number[]
): number | null {
  const perTx = new Map<string, number>();

  for (const index of ratingIdx) {
    const hash = feedback[index]?.txHash;

    if (hash) perTx.set(hash, (perTx.get(hash) ?? 0) + 1);
  }

  const groupedRows = [...perTx.values()].reduce((sum, count) => sum + count, 0);

  const repeatedRows = [...perTx.values()]
    .flatMap((count) => (count > 1 ? [count] : []))
    .reduce((sum, count) => sum + count, 0);

  return groupedRows ? repeatedRows / groupedRows : null;
}

function walletRowCounts(
  feedback: readonly FeedbackInput[],
  ratingIdx: readonly number[]
): number[] {
  const perClient = new Map<string, number>();

  for (const index of ratingIdx) {
    const client = feedback[index]?.client.toLowerCase() ?? '';
    perClient.set(client, (perClient.get(client) ?? 0) + 1);
  }

  return [...perClient.values()];
}

/** The same concentration numbers before unit collapsing, one row = one vote. */
export function rawConcentration(
  feedback: readonly FeedbackInput[],
  ratingIdx: readonly number[]
): RawConcentration {
  const counts = walletRowCounts(feedback, ratingIdx).toSorted((a, b) => b - a);
  const total = ratingIdx.length || 1;
  const top = (k: number) => counts.slice(0, k).reduce((sum, count) => sum + count, 0) / total;
  const squares = counts.reduce((sum, count) => sum + count * count, 0);

  return {
    rawTop1: top(1),
    rawTop3: top(3),
    rawNeff: ratingIdx.length && squares ? ratingIdx.length ** 2 / squares : 0,
  };
}

export function responsivenessOf(
  feedback: readonly FeedbackInput[],
  classified: readonly Classified[],
  ratingIdx: readonly number[],
  selves: readonly string[]
): Responsiveness {
  const selfSet = new Set(selves.map((address) => address.toLowerCase()));
  const lowIdx = ratingIdx.filter((index) => (classified[index]?.r ?? 1) <= 0.5);
  const responders = lowIdx.flatMap((index) => feedback[index]?.responses ?? []);

  const ownerReplies = responders.filter((response) =>
    selfSet.has(response.responder.toLowerCase())
  ).length;

  const lags = lowIdx.flatMap((index) => {
    const row = feedback[index];

    if (!row || row.createdAt === undefined) return [];

    // Time to the first answer, not to every later reply.
    const first = (row.responses ?? [])
      .flatMap((response) => (response.createdAt === undefined ? [] : [response.createdAt]))
      .toSorted((a, b) => a - b)[0];

    return first === undefined ? [] : [(first - row.createdAt) / 86400];
  });

  const answered = lowIdx.filter((index) => (feedback[index]?.responses ?? []).length > 0).length;

  return {
    lowRatings: lowIdx.length,
    responded: answered,
    share: lowIdx.length ? answered / lowIdx.length : null,
    medianLagDays: median(lags),
    ownerReplies,
    thirdPartyReplies: responders.length - ownerReplies,
  };
}
