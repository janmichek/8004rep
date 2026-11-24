import { useNavigate } from '@tanstack/react-router';
import {
  isNestedControl,
  useSort,
  type ChainInfo,
  type FeedbackEvent,
  type SortColumn,
} from '../../../shared/lib/explorer';
import { SortHeaderRow, latestFeedbackColumns } from '../../../shared/ui';
import { ReviewerFeedbackRow } from './ReviewerFeedbackRow';

type Props = { items: FeedbackEvent[]; chain: ChainInfo };

const FEEDBACK_COLUMNS: SortColumn<FeedbackEvent>[] = [
  { key: 'agent', value: (row) => row.agentName ?? `Agent #${row.tokenId}` },
  { key: 'value', value: (row) => row.value, numeric: true },
  { key: 'when', value: (row) => row.createdAt, numeric: true },
];

function rowKey(row: FeedbackEvent): string {
  return `${row.chainId ?? 0}:${row.tokenId}:${row.client}:${row.index ?? row.txHash ?? ''}`;
}

export function ReviewerFeedbackTable({ items, chain }: Props) {
  const navigate = useNavigate();
  const { sorted, state, toggle } = useSort(items, FEEDBACK_COLUMNS);

  function open(tokenId: bigint, event?: { target: EventTarget | null }) {
    if (event && isNestedControl(event.target)) return;

    void navigate({
      to: '/agents/$slug/$id',
      params: { slug: chain.slug, id: tokenId.toString() },
    });
  }

  return (
    <section className="panel">
      <h3>Latest Feedback</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <SortHeaderRow columns={latestFeedbackColumns(false)} state={state} toggle={toggle} />
          </thead>
          <tbody>
            {sorted.slice(0, 50).map((row) => (
              <ReviewerFeedbackRow key={rowKey(row)} row={row} chain={chain} onOpen={open} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
