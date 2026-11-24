import type { EvidenceBand } from '../../lib/explorer/data/txChecks';
import { Hint } from './Hint';
import { STATUS_LABEL, bandSegments } from './txDetailView';

export function TxDetailBand({ band }: { band: EvidenceBand }) {
  const segments = bandSegments(band);

  return (
    <Hint text="Checks that pass, out of all checks with a verdict. The upper end counts the unknown ones as passing: what could not be read from here may still hold.">
      <div className="tx-band" tabIndex={0}>
        <span>
          <b>
            {band.low}
            {band.high !== band.low ? `–${band.high}` : ''}
          </b>{' '}
          of {band.total}
        </span>
        <span className="tx-bar" aria-hidden="true">
          {segments.map((segment) => (
            <span
              key={segment.status}
              className={`status-${segment.status}`}
              style={{ flex: segment.count }}
            />
          ))}
        </span>
        {segments.map((segment) => (
          <span key={segment.status} className={`tx-count status-${segment.status}`}>
            {segment.count} {STATUS_LABEL[segment.status]}
          </span>
        ))}
      </div>
    </Hint>
  );
}
