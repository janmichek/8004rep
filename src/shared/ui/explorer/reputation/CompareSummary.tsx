import type { ScanScore } from '../../../lib/explorer/data/scan';
import type { Feedback } from '../../../lib/explorer/data/types';
import { formatNumber } from '../../../lib/explorer';

type Props = {
  scan: ScanScore;
  feedback: Feedback[];
  raw: number | null;
  trusted: number | null;
};

export function CompareSummary({ scan, feedback, raw, trusted }: Props) {
  return (
    <div className="compare-head">
      <div>
        <div className="tile-label">8004scan overall</div>
        <div className="compare-value">{formatNumber(scan.total)}</div>
        <small className="muted">rates the whole listing</small>
      </div>
      <div>
        <div className="tile-label">Its feedback average</div>
        <div className="compare-value">{formatNumber(scan.feedback?.average)}</div>
        <small className="muted">plain mean, {scan.feedback?.count ?? '?'} rows</small>
      </div>
      <div>
        <div className="tile-label">Raw on-chain here</div>
        <div className="compare-value">{formatNumber(raw)}</div>
        <small className="muted">{feedback.length} rows read</small>
      </div>
      <div>
        <div className="tile-label">Filtered here</div>
        <div className="compare-value accent">{formatNumber(trusted)}</div>
        <small className="muted">one vote per wallet, ratings only</small>
      </div>
    </div>
  );
}
