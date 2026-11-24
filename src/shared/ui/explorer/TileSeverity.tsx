import type { CSSProperties } from 'react';
import type { TileMeter } from './tileTypes';

export function TileSeverity({ meter }: { meter: Extract<TileMeter, { kind: 'severity' }> }) {
  const style: CSSProperties & { '--segs': number } = { '--segs': meter.max };

  return (
    <div className="tile-severity" style={style}>
      {Array.from({ length: meter.max }, (_, index) => (
        <span key={index} className={`tile-sev${index + 1 <= meter.level ? ' on' : ''}`} />
      ))}
    </div>
  );
}
