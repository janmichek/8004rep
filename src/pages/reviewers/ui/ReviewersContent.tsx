import type { ReviewerProfile } from '../../../shared/lib/explorer';
import { ReviewersTable } from './ReviewersTable';

type Props = {
  rows: ReviewerProfile[];
  all: boolean;
  hasMore: boolean;
  loading: boolean;
  sortState: (key: string) => 'asc' | 'desc' | null;
  onToggle: (key: string) => void;
  onOpen: (reviewer: ReviewerProfile, event?: { target: EventTarget | null }) => void;
  onLoadOlder: () => void;
};

export function ReviewersContent({
  rows,
  all,
  hasMore,
  loading,
  sortState,
  onToggle,
  onOpen,
  onLoadOlder,
}: Props) {
  return (
    <>
      {rows.length === 0 ? (
        <p className="state muted">No reviewers in the loaded feedback.</p>
      ) : (
        <ReviewersTable
          rows={rows}
          all={all}
          sortState={sortState}
          onToggle={onToggle}
          onOpen={onOpen}
        />
      )}

      <p className="muted note">
        {hasMore ? (
          <button type="button" disabled={loading} onClick={onLoadOlder}>
            {loading ? 'Loading…' : 'Load older feedback'}
          </button>
        ) : (
          <span>That is everything the source holds.</span>
        )}
      </p>
    </>
  );
}
