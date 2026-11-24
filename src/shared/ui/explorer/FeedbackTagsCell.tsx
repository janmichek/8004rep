import type { Feedback } from '../../lib/explorer/data/types';

export function FeedbackTagsCell({ row }: { row: Feedback }) {
  return (
    <td className="tags">
      {row.tag1 ? (
        <span className="chip clip-chip" title={row.tag1}>
          {row.tag1}
        </span>
      ) : null}
      {row.tag2 ? (
        <span className="chip clip-chip" title={row.tag2}>
          {row.tag2}
        </span>
      ) : null}
    </td>
  );
}
