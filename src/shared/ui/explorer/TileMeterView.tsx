import { TileGauge } from './TileGauge';
import { TileSeverity } from './TileSeverity';
import { TileSteps } from './TileSteps';
import type { TileMeter } from './tileTypes';

export function TileMeterView({ meter }: { meter: TileMeter }) {
  if (meter.kind === 'gauge') return <TileGauge meter={meter} />;

  if (meter.kind === 'steps') return <TileSteps meter={meter} />;

  return <TileSeverity meter={meter} />;
}
