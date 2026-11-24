import type { ReactNode } from 'react';
import type { ChainInfo } from '../../lib/explorer';
import { formatDate, formatTimeline } from '../../lib/explorer';
import { FeedbackAuthenticityCell } from './FeedbackAuthenticityCell';
import { FeedbackLinksCell } from './FeedbackLinksCell';
import { FeedbackNotesCell } from './FeedbackNotesCell';
import { FeedbackRepliesCell } from './FeedbackRepliesCell';
import { FeedbackReviewerCell } from './FeedbackReviewerCell';
import { FeedbackTagsCell } from './FeedbackTagsCell';
import { FeedbackValueCell } from './FeedbackValueCell';
import type { ListRow } from './feedbackListTypes';

type Props = {
  entry: ListRow;
  chain: ChainInfo;
  hasStats: boolean;
  hasNotes: boolean;
  renderReviewer?: ((address: string) => ReactNode) | undefined;
  onDetail?: ((index: number) => void) | undefined;
};

function whenCell(createdAt: number | undefined) {
  if (createdAt) {
    return (
      <td className="nowrap">
        <span title={formatDate(createdAt)}>{formatTimeline(createdAt)}</span>
      </td>
    );
  }

  return (
    <td className="nowrap">
      <span className="muted" title="Older than the log scan window, or the source has no dates">
        —
      </span>
    </td>
  );
}

export function FeedbackRow({ entry, chain, hasStats, hasNotes, renderReviewer, onDetail }: Props) {
  const clickable = onDetail !== undefined;

  function open() {
    onDetail?.(entry.index);
  }

  return (
    <tr
      className={`${entry.row.revoked ? 'revoked' : ''}${clickable ? ' row-link' : ''}`.trim()}
      role={clickable ? 'link' : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-label={clickable ? `Open feedback detail #${entry.index}` : undefined}
      onClick={(event) => {
        if (!clickable) return;

        if (
          event.target instanceof Element &&
          event.target.closest('a, button, input, select, textarea, label')
        )
          return;
        open();
      }}
      onKeyDown={(event) => {
        if (!clickable) return;

        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          open();
        }
      }}
    >
      <FeedbackReviewerCell row={entry.row} chain={chain} renderReviewer={renderReviewer} />
      <FeedbackValueCell row={entry.row} stats={entry.stats} />
      <FeedbackTagsCell row={entry.row} />
      {hasNotes ? <FeedbackNotesCell entry={entry} /> : null}
      {hasStats ? <FeedbackAuthenticityCell stats={entry.stats} /> : null}
      <FeedbackLinksCell row={entry.row} chain={chain} />
      {whenCell(entry.row.createdAt)}
      <FeedbackRepliesCell entry={entry} />
    </tr>
  );
}
