import type { ReviewerStats } from '../../../lib/explorer/data/feedbackStats';

export type ReviewerRow = ReviewerStats & {
  scoreShare: number | null;
  scoreWithout: number | null;
};

export function rowLookupPending(row: ReviewerRow, rows: ReviewerRow[]): boolean {
  return rows.findIndex((entry) => entry.client === row.client) < 12;
}
