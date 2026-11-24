import type { RowStats } from '../../lib/explorer/data/feedbackStats';
import { KIND_INFO } from '../../lib/explorer/data/reputation/kinds';
import { Hint } from './Hint';

export function FeedbackKindMark({ stats }: { stats: RowStats | undefined }) {
  if (stats && stats.kind !== 'rating') {
    return (
      <Hint text={KIND_INFO[stats.kind].rule}>
        <span className="chip">{KIND_INFO[stats.kind].label}</span>
      </Hint>
    );
  }

  if (stats && stats.rating === null) {
    return (
      <Hint text="A rating whose value fits no inferred scale; listed, never scored.">
        <span className="chip warn">off-scale</span>
      </Hint>
    );
  }

  return null;
}
