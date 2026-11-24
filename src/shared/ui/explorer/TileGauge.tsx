import type { TileMeter } from './tileTypes';

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, n));
}

export function TileGauge({ meter }: { meter: Extract<TileMeter, { kind: 'gauge' }> }) {
  return (
    <div className="tile-gauge">
      {meter.band ? (
        <span
          className="tile-gauge-band"
          style={{
            left: `${clampPct(meter.band[0])}%`,
            width: `${clampPct(meter.band[1] - meter.band[0])}%`,
          }}
        />
      ) : null}
      <span
        className="tile-gauge-fill"
        style={{ width: meter.value === null ? '0%' : `${clampPct(meter.value)}%` }}
      />
      {meter.value !== null ? (
        <span className="tile-gauge-mark" style={{ left: `${clampPct(meter.value)}%` }} />
      ) : null}
    </div>
  );
}
