import { formatPercent } from '../../../lib/explorer';
import type { ReviewerRow } from './reviewerRow';

export function ReviewerScoreCell({ row }: { row: ReviewerRow }) {
  return (
    <td>
      <span
        className="inline-meter"
        title={`${formatPercent(row.scoreShare)} of the capped wallet weight, ${formatPercent(row.share)} of counted reviews`}
      >
        <span className="bar-track" aria-hidden="true">
          <span style={{ width: `${(row.scoreShare ?? 0) * 100}%` }} />
        </span>
        {row.scoreShare === null ? '—' : formatPercent(row.scoreShare)}
      </span>
    </td>
  );
}
