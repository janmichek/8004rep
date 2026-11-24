import type { FeedbackEvent } from '../../../shared/lib/explorer';
import { SortHeader } from '../../../shared/ui';
import { FeedbacksTableRow } from './FeedbacksTableRow';

type Props = {
  rows: FeedbackEvent[];
  all: boolean;
  slug: string;
  sortState: (key: string) => 'asc' | 'desc' | null;
  toggle: (key: string) => void;
  onOpen: (row: FeedbackEvent, event?: { target: EventTarget | null }) => void;
};

export function FeedbacksTable({ rows, all, slug, sortState, toggle, onOpen }: Props) {
  if (rows.length === 0) return <p className="state muted">No feedback found on these networks.</p>;

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {all ? (
              <SortHeader
                label="Network"
                active={sortState('network')}
                onSort={() => toggle('network')}
              />
            ) : null}
            <SortHeader label="Agent" active={sortState('agent')} onSort={() => toggle('agent')} />
            <SortHeader
              label="Reviewer"
              active={sortState('reviewer')}
              onSort={() => toggle('reviewer')}
            />
            <SortHeader
              label="Value"
              numeric
              active={sortState('value')}
              onSort={() => toggle('value')}
            />
            <th>Tags</th>
            <th>Text</th>
            <SortHeader
              label="When"
              numeric
              active={sortState('when')}
              onSort={() => toggle('when')}
            />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <FeedbacksTableRow
              key={`${row.chainId ?? 0}:${row.tokenId}:${row.client}:${row.index ?? row.feedbackURI ?? row.tag1 ?? 'row'}`}
              row={row}
              slug={slug}
              all={all}
              onOpen={onOpen}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
