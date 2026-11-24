import { formatNumber } from '../../../lib/explorer';
import { LABEL_INFO } from '../../../lib/explorer/data/reviewerProfile';
import type { ReviewerInsight } from '../../../lib/explorer/data/reviewerInsights';
import { Hint } from '../Hint';
import { ReviewerChip } from '../ReviewerChip';
import { Skeleton } from '../Skeleton';

type Props = {
  insight: ReviewerInsight | undefined;
  lookupPending: boolean;
};

export function ReviewerElsewhereCell({ insight, lookupPending }: Props) {
  const profile = insight?.profile;

  if (profile) {
    return (
      <td>
        <span className="nowrap">
          {profile.agents} agent{profile.agents === 1 ? '' : 's'} · rating avg{' '}
          {formatNumber(profile.ratingAverage)}
          {insight.truncated ? '+' : ''}
        </span>
        {profile.labels.map((label) => (
          <Hint key={label} text={LABEL_INFO[label].rule}>
            <ReviewerChip label={label} />
          </Hint>
        ))}
      </td>
    );
  }

  if (insight) {
    return (
      <td>
        <Hint text={insight.errors.join('\n')}>
          <span className="muted">unavailable</span>
        </Hint>
      </td>
    );
  }

  return (
    <td>
      {lookupPending ? <Skeleton width="8em" /> : <span className="muted">open profile</span>}
    </td>
  );
}
