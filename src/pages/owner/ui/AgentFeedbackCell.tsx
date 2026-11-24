import { formatScore, type ReputationSummary } from '../../../shared/lib/explorer';
import { Skeleton } from '../../../shared/ui';

type Props = {
  score: ReputationSummary | undefined;
  loading: boolean | undefined;
};

function labelFor(score: ReputationSummary | undefined): string | undefined {
  if (!score) return undefined;

  if (score.count === 0) return '0';

  const count = `${score.capped ? '≥' : ''}${score.count}`;

  return `${count} · avg ${formatScore(score.average)}`;
}

export function AgentFeedbackCell({ score, loading }: Props) {
  const label = labelFor(score);

  return (
    <td
      className="num"
      title={score?.capped ? 'Count and average of the first 200 clients' : undefined}
    >
      {loading ? <Skeleton width="5.5em" /> : null}
      {!loading && label !== undefined ? label : null}
      {!loading && label === undefined ? <span className="muted">—</span> : null}
    </td>
  );
}
