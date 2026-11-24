import type { Feedback } from '../../lib/explorer/data/types';
import { FeedbackNote } from './FeedbackNote';

export function FeedbackTextCell({ row }: { row: Feedback }) {
  return (
    <td className="text-cell">
      {row.feedbackURI ? <FeedbackNote uri={row.feedbackURI} /> : <span className="muted">—</span>}
    </td>
  );
}
