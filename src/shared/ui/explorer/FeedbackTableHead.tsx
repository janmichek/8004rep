import { Hint } from './Hint';
import { SortHeader } from './SortHeader';
import type { SortDir } from '../../lib/explorer/hooks/useSort';

type Props = {
  hasStats: boolean;
  hasNotes: boolean;
  state: (key: string) => SortDir | null;
  toggle: (key: string) => void;
};

export function FeedbackTableHead({ hasStats, hasNotes, state, toggle }: Props) {
  return (
    <thead>
      <tr>
        <SortHeader label="Reviewer" active={state('reviewer')} onSort={() => toggle('reviewer')} />
        <SortHeader label="Value" numeric active={state('value')} onSort={() => toggle('value')} />
        <SortHeader label="Tags" active={state('tags')} onSort={() => toggle('tags')} />
        {hasNotes ? (
          <Hint text="The text (or comment) field of the off-chain feedback file">
            <th>Text</th>
          </Hint>
        ) : null}
        {hasStats ? (
          <SortHeader
            label="Authenticity"
            text="Pattern-based authenticity weight, from 0 to 1. It is not the score's unit weight: only scored ratings enter the Filtered score."
            active={state('weight')}
            onSort={() => toggle('weight')}
          />
        ) : null}
        <th>Link</th>
        <SortHeader label="When" numeric active={state('when')} onSort={() => toggle('when')} />
        <SortHeader
          label="Replies"
          text="appendResponse entries: agent replies, refunds, spam flags"
          numeric
          active={state('replies')}
          onSort={() => toggle('replies')}
        />
      </tr>
    </thead>
  );
}
