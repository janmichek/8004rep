import type { CSSProperties } from 'react';
import type { TileMeter } from './tileTypes';

export function TileSteps({ meter }: { meter: Extract<TileMeter, { kind: 'steps' }> }) {
  const style: CSSProperties & { '--steps': number } = { '--steps': meter.total };

  return (
    <div className="tile-steps" style={style}>
      {Array.from({ length: meter.total }, (_, index) => (
        <span key={index} className={`tile-step${index + 1 <= meter.filled ? ' on' : ''}`} />
      ))}
    </div>
  );
}
