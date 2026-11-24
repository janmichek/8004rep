import type { Feedback } from '../../lib/explorer/data/types';
import { evidenceUrl } from './feedbackUrls';

export function FeedbackFileCell({ row }: { row: Feedback }) {
  const file = evidenceUrl(row.feedbackURI);

  return (
    <td className="nowrap">
      {file ? (
        <a
          href={file}
          target="_blank"
          rel="noopener noreferrer"
          title="Feedback file (off-chain file)"
        >
          · file ↗
        </a>
      ) : (
        <span className="muted">—</span>
      )}
    </td>
  );
}
