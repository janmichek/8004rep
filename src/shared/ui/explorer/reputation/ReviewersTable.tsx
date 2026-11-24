import type { ChainInfo } from '../../../lib/explorer';
import type { ReviewerInsight } from '../../../lib/explorer/data/reviewerInsights';
import { useSort } from '../../../lib/explorer/hooks/useSort';
import { ReviewerRowView } from './ReviewerRowView';
import type { ReviewerRow } from './reviewerRow';
import { ReviewersTableHead } from './ReviewersTableHead';

type Props = {
  rows: ReviewerRow[];
  chain: ChainInfo;
  self: string[];
  insights: Map<string, ReviewerInsight>;
  loading: boolean;
};

const SHOWN = 50;

export function ReviewersTable({ rows, chain, self, insights, loading }: Props) {
  const { sorted, state, toggle } = useSort(rows, [
    { key: 'reviewer', value: (row) => row.client },
    { key: 'reviews', value: (row) => row.rows, numeric: true },
    { key: 'weight', value: (row) => row.scoreShare, numeric: true },
    { key: 'average', value: (row) => row.ratingAverage, numeric: true },
    { key: 'without', value: (row) => row.scoreWithout, numeric: true },
  ]);

  return (
    <>
      <div className="table-wrap">
        <table className="reviewers-table">
          <ReviewersTableHead state={state} toggle={toggle} />
          <tbody>
            {sorted.slice(0, SHOWN).map((row) => (
              <ReviewerRowView
                key={row.client}
                row={row}
                rows={rows}
                chain={chain}
                self={self}
                insight={insights.get(row.client.toLowerCase())}
                loading={loading}
              />
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > SHOWN ? (
        <p className="muted note">
          Top {SHOWN} of {rows.length} reviewers by weight.
        </p>
      ) : null}
    </>
  );
}
