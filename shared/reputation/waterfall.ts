import { REPORT_STEPS } from './spec';

export type ReportStep = {
  id: string;
  label: string;
  rule: string;
  /** 0–100; null once nothing is left. */
  average: number | null;
  rows: number;
  delta: number | null;
};

export type WaterfallInputs = {
  rawAll: number | null;
  feedbackCount: number;
  raw: number | null;
  validCount: number;
  rawRatingsAll: number | null;
  allRatingCount: number;
  rawRatings: number | null;
  ratingCount: number;
  unitMean: number | null;
  capped: number | null;
  walletsAfterCap: number;
  score: number | null;
};

type Row = { average: number | null; rows: number };

/**
 * The waterfall is the score's audit trail: every step keeps the previous
 * average and shows the points it moved. Labels and rules come from the
 * published spec, so the UI and the JSON report cannot drift.
 */
export function buildWaterfall(input: WaterfallInputs): ReportStep[] {
  const rows: Row[] = [
    { average: input.rawAll, rows: input.feedbackCount },
    { average: input.raw, rows: input.validCount },
    { average: input.rawRatingsAll, rows: input.allRatingCount },
    { average: input.rawRatings, rows: input.ratingCount },
    { average: input.unitMean, rows: input.ratingCount },
    { average: input.capped, rows: input.walletsAfterCap },
    { average: input.score, rows: input.ratingCount },
  ];

  const steps: ReportStep[] = [];
  let before: number | null = null;
  rows.forEach((row, index) => {
    const meta = REPORT_STEPS[index] ?? { id: '', label: '', rule: '' };
    steps.push({
      id: meta.id,
      label: meta.label,
      rule: meta.rule,
      average: row.average,
      rows: row.rows,
      delta: before !== null && row.average !== null ? row.average - before : null,
    });
    before = row.average;
  });

  return steps;
}
