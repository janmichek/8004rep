import { StatTiles } from '../../../shared/ui';
import { networkTotalTiles } from './networkTotalTiles';

export function NetworkTotals(props: {
  feedback30d: number | null | undefined;
  totalFeedback: number | null | undefined;
  ratedAgents: number | null | undefined;
  loading: boolean;
}) {
  return <StatTiles tiles={networkTotalTiles(props)} />;
}
