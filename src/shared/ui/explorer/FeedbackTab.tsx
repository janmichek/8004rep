import { useMemo, useState, type ReactNode } from 'react';
import type { ChainInfo } from '../../lib/explorer';
import type { FeedbackStats } from '../../lib/explorer/data/feedbackStats';
import type { AgentDetail } from '../../lib/explorer/data/types';
import { FeedbackList } from './FeedbackList';
import type { ListRow } from './feedbackListTypes';
import { Segmented } from './Segmented';
import { SelectMenu } from './SelectMenu';

type Filter = 'all' | 'rating' | 'other' | 'full' | 'flagged' | 'revoked' | 'replied';

type Props = {
  agent: AgentDetail;
  chain: ChainInfo;
  stats: FeedbackStats;
  renderReviewer?: ((address: string) => ReactNode) | undefined;
  onDetail?: ((index: number) => void) | undefined;
};

const SORTS = [
  { value: 'newest', label: 'newest' },
  { value: 'value', label: 'value' },
  { value: 'weight', label: 'lowest authenticity' },
];

function isScored(row: ListRow): boolean {
  if (row.row.revoked) return false;

  return row.stats?.kind === 'rating' && row.stats.rating !== null;
}

const FILTERS: { id: Filter; label: string; test: (row: ListRow) => boolean }[] = [
  { id: 'all', label: 'All', test: () => true },
  { id: 'rating', label: 'Scored', test: isScored },
  { id: 'other', label: 'Not scored', test: (row) => !row.row.revoked && !isScored(row) },
  {
    id: 'full',
    label: 'Full authenticity',
    test: (row) => !row.row.revoked && row.stats?.weight === 1,
  },
  {
    id: 'flagged',
    label: 'Discounted',
    test: (row) => !row.row.revoked && (row.stats?.weight ?? 1) < 1,
  },
  { id: 'revoked', label: 'Revoked', test: (row) => row.row.revoked },
  { id: 'replied', label: 'With replies', test: (row) => Boolean(row.row.responses?.length) },
];

export function FeedbackTab({ agent, chain, stats, renderReviewer, onDetail }: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState('newest');

  const all = useMemo<ListRow[]>(
    () => agent.feedback.map((row, index) => ({ row, stats: stats.rows[index], index })),
    [agent.feedback, stats.rows]
  );

  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((entry) => [entry.id, all.filter(entry.test).length])),
    [all]
  );

  const segments = FILTERS.map((entry) => ({
    id: entry.id,
    label: entry.label,
    count: counts[entry.id] ?? 0,
    disabled: (counts[entry.id] ?? 0) === 0 && entry.id !== 'all',
  }));

  const rows = all.filter(FILTERS.find((entry) => entry.id === filter)?.test ?? (() => true));

  function sortedRows(): ListRow[] {
    if (sort === 'value') return rows.toSorted((a, b) => b.row.value - a.row.value);

    if (sort === 'weight')
      return rows.toSorted((a, b) => (a.stats?.weight ?? 1) - (b.stats?.weight ?? 1));

    return rows;
  }

  return (
    <>
      <div className="toolbar">
        <Segmented
          label="Filter feedback"
          segments={segments}
          value={filter}
          onChange={setFilter}
        />
        <div className="sort">
          Sort
          <SelectMenu
            compact
            label="Sort feedback"
            value={sort}
            options={SORTS}
            onChange={setSort}
          />
        </div>
      </div>
      <FeedbackList
        rows={sortedRows()}
        chain={chain}
        renderReviewer={renderReviewer}
        onDetail={onDetail}
      />
    </>
  );
}
