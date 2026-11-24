import { agentScanUrl, formatNumber, type ChainInfo } from '../../../lib/explorer';
import type { ScanScore } from '../../../lib/explorer/data/scan';
import type { Feedback } from '../../../lib/explorer/data/types';
import { notesFor } from './compareNotes';

type Props = {
  chain: ChainInfo;
  tokenId: bigint;
  feedback: Feedback[];
  raw: number | null;
  scan: ScanScore;
};

export function CompareDetails({ chain, tokenId, feedback, raw, scan }: Props) {
  const notes = notesFor(scan, raw, feedback);

  return (
    <>
      <section className="panel">
        <h3>
          Its dimensions <small className="muted">score · weight in the total</small>
        </h3>
        <ul className="bars">
          {scan.dimensions.map((dimension) => (
            <li key={dimension.id}>
              <span className="bar-label">
                {dimension.label}{' '}
                <small className="muted">{Math.round(dimension.weight * 100)}%</small>
              </span>
              <span className="bar-track" aria-hidden="true">
                <span style={{ width: `${Math.min(100, dimension.score)}%` }} />
              </span>
              <span className="bar-value">{formatNumber(dimension.score)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <h3>Why the numbers differ</h3>
        <ul className="reasons">
          {notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
        <p className="muted note">
          {scan.algorithm ?? 'Scoring'}
          {scan.scoredAt ? `, scored ${scan.scoredAt.slice(0, 10)}` : ''}.{' '}
          <a href={agentScanUrl(chain, tokenId)} target="_blank" rel="noopener noreferrer">
            Open on 8004scan ↗
          </a>
        </p>
      </section>
    </>
  );
}
