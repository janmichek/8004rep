import { FLAG_INFO } from '../../../lib/explorer/data/feedbackStats';
import { FlagChip } from '../FlagChip';
import { Hint } from '../Hint';
import type { ReviewerRow } from './reviewerRow';

export function ReviewerFlagsCell({ row }: { row: ReviewerRow }) {
  return (
    <td>
      {row.flags.map((flag) => (
        <Hint key={flag} text={FLAG_INFO[flag].rule}>
          <FlagChip flag={flag} />
        </Hint>
      ))}
    </td>
  );
}
