import { formatScore } from '../../lib/explorer';
import type { RowStats } from '../../lib/explorer/data/feedbackStats';
import type { Feedback } from '../../lib/explorer/data/types';
import { FlagChip } from './FlagChip';
import { FeedbackKindMark } from './FeedbackKindMark';

export function FeedbackValueCell({ row, stats }: { row: Feedback; stats: RowStats | undefined }) {
  const rating = stats && stats.kind === 'rating' ? stats.rating : null;

  return (
    <td className="num">
      <b>{formatScore(row.value)}</b>
      {row.revoked ? <FlagChip flag="revoked" /> : null}
      <FeedbackKindMark stats={stats} />
      {rating !== null ? (
        <small className="muted" title="Normalised rating used by the Filtered score">
          → {formatScore(rating * 100)}
        </small>
      ) : null}
    </td>
  );
}
