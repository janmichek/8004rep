import type { ReactNode } from 'react';
import type { ChainInfo } from '../../lib/explorer';
import { useSort } from '../../lib/explorer/hooks/useSort';
import { FeedbackRow } from './FeedbackRow';
import { FeedbackTableHead } from './FeedbackTableHead';
import type { ListRow } from './feedbackListTypes';

type Props = {
  rows: ListRow[];
  chain: ChainInfo;
  renderReviewer?: ((address: string) => ReactNode) | undefined;
  onDetail?: ((index: number) => void) | undefined;
};

export function FeedbackList({ rows, chain, renderReviewer, onDetail }: Props) {
  const hasStats = rows.some((entry) => entry.stats);
  const hasNotes = rows.some((entry) => entry.row.feedbackURI);

  const { sorted, state, toggle } = useSort(rows, [
    { key: 'reviewer', value: (entry) => entry.row.client },
    { key: 'value', value: (entry) => entry.row.value, numeric: true },
    { key: 'tags', value: (entry) => entry.row.tag1 },
    { key: 'weight', value: (entry) => entry.stats?.weight, numeric: true },
    { key: 'when', value: (entry) => entry.row.createdAt, numeric: true },
    { key: 'replies', value: (entry) => entry.row.responses?.length, numeric: true },
  ]);

  if (rows.length === 0) return <p className="muted">No feedback match.</p>;

  return (
    <div className="table-wrap">
      <table className="feedback-table">
        <FeedbackTableHead hasStats={hasStats} hasNotes={hasNotes} state={state} toggle={toggle} />
        <tbody>
          {sorted.map((entry) => (
            <FeedbackRow
              key={entry.index}
              entry={entry}
              chain={chain}
              hasStats={hasStats}
              hasNotes={hasNotes}
              renderReviewer={renderReviewer}
              onDetail={onDetail}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
