import { formatNumber } from '../../lib/explorer';
import { FLAG_INFO, type RowStats } from '../../lib/explorer/data/feedbackStats';
import { FlagChip } from './FlagChip';
import { Hint } from './Hint';

export function FeedbackAuthenticityCell({ stats }: { stats: RowStats | undefined }) {
  if (!stats) return null;
  const scored = stats.kind === 'rating' && stats.rating !== null;

  return (
    <td className="checks-cell">
      {scored ? (
        <Hint text="Pattern-based authenticity weight; not the score's unit weight">
          <span className={`weight${stats.weight < 0.5 ? ' low' : ''}`}>
            {formatNumber(stats.weight, 2)}
          </span>
        </Hint>
      ) : (
        <span className="muted" title="Only scored ratings enter the Filtered score">
          not scored
        </span>
      )}
      {stats.flags.map((flag) =>
        flag === 'revoked' ? null : (
          <Hint key={flag} text={FLAG_INFO[flag].rule}>
            <FlagChip flag={flag} />
          </Hint>
        )
      )}
    </td>
  );
}
