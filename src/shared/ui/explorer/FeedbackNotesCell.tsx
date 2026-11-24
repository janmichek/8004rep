import { FeedbackNote } from './FeedbackNote';
import type { ListRow } from './feedbackListTypes';

export function FeedbackNotesCell({ entry }: { entry: ListRow }) {
  return (
    <td>
      {entry.row.feedbackURI ? (
        <FeedbackNote uri={entry.row.feedbackURI} />
      ) : (
        <span className="muted">—</span>
      )}
    </td>
  );
}
