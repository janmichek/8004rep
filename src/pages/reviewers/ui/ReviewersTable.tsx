import type { ReviewerProfile } from '../../../shared/lib/explorer';
import { SortHeader } from '../../../shared/ui';
import { ReviewerRow } from './ReviewerRow';

type Props = {
  rows: ReviewerProfile[];
  all: boolean;
  sortState: (key: string) => 'asc' | 'desc' | null;
  onToggle: (key: string) => void;
  onOpen: (reviewer: ReviewerProfile, event?: { target: EventTarget | null }) => void;
};

export function ReviewersTable({ rows, all, sortState, onToggle, onOpen }: Props) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <SortHeader
              label="Reviewer"
              active={sortState('reviewer')}
              onSort={() => onToggle('reviewer')}
            />
            <SortHeader
              label="Reviews"
              numeric
              active={sortState('reviews')}
              onSort={() => onToggle('reviews')}
            />
            <SortHeader
              label="Agents"
              numeric
              active={sortState('agents')}
              onSort={() => onToggle('agents')}
            />
            {all ? <th>Networks</th> : null}
            <SortHeader
              label="Avg rating"
              numeric
              text="Scored ratings only, normalised to 0–100"
              active={sortState('average')}
              onSort={() => onToggle('average')}
            />
            <SortHeader
              label="Flags"
              active={sortState('flags')}
              onSort={() => onToggle('flags')}
            />
          </tr>
        </thead>
        <tbody>
          {rows.map((reviewer) => (
            <ReviewerRow key={reviewer.address} reviewer={reviewer} all={all} onOpen={onOpen} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
