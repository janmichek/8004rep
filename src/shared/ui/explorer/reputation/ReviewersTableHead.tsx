import type { SortDir } from '../../../lib/explorer/hooks/useSort';
import { Hint } from '../Hint';
import { SortHeader } from '../SortHeader';

type Props = { state: (key: string) => SortDir | null; toggle: (key: string) => void };

export function ReviewersTableHead({ state, toggle }: Props) {
  return (
    <thead>
      <tr>
        <SortHeader label="Reviewer" active={state('reviewer')} onSort={() => toggle('reviewer')} />
        <SortHeader
          label="Reviews"
          numeric
          text="Reviews on this agent (revoked in brackets)"
          active={state('reviews')}
          onSort={() => toggle('reviews')}
        />
        <SortHeader
          label="Score share"
          text="Share of the capped wallet weight behind the Filtered score"
          active={state('weight')}
          onSort={() => toggle('weight')}
        />
        <SortHeader
          label="Avg rating"
          numeric
          text="Normalised rating average here, with min–max; telemetry and metrics are excluded"
          active={state('average')}
          onSort={() => toggle('average')}
        />
        <SortHeader
          label="Score without it"
          numeric
          text="Filtered score without this reviewer's wallet minus the score with it"
          active={state('without')}
          onSort={() => toggle('without')}
        />
        <th>Flags here</th>
        <Hint text="Its feedback on other agents, as far as the source reaches">
          <th>Elsewhere</th>
        </Hint>
        <Hint text="Transactions sent, and who first sent it funds">
          <th>Wallet</th>
        </Hint>
      </tr>
    </thead>
  );
}
