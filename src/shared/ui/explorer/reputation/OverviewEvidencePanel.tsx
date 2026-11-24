import { Link } from '@tanstack/react-router';
import type { FeedbackStats } from '../../../lib/explorer/data/feedbackStats';
import type { TrustReport } from '../../../lib/explorer/data/trustReport';
import { formatPercent } from '../../../lib/explorer';
import { Hint } from '../Hint';
import { LADDER_COLOR } from './waterfallMeta';

type Props = { report: TrustReport; stats: FeedbackStats };

function coverageOf(stats: FeedbackStats) {
  const total = stats.coverage.total || 1;

  return [
    {
      label: 'Dated',
      n: stats.coverage.dated,
      rule: 'Burst, surge and trend checks need a date.',
      docs: 'coverage',
    },
    {
      label: 'Transaction known',
      n: stats.coverage.withTx,
      rule: 'Lets the Tx detail check who sent and paid for the feedback.',
      docs: 'coverage',
    },
    {
      label: 'Feedback file',
      n: stats.coverage.withUri,
      rule: 'Comment, task or payment proof behind the feedback.',
      docs: 'evidence-ladder',
    },
    {
      label: 'Endpoint named',
      n: stats.coverage.withEndpoint,
      rule: 'Says which service was rated.',
      docs: 'coverage',
    },
  ].map((entry) => ({ ...entry, share: entry.n / total }));
}

export function OverviewEvidencePanel({ report, stats }: Props) {
  const ladderTotal = report.ladder.reduce((sum, rung) => sum + rung.rows, 0);
  const coverage = coverageOf(stats);

  return (
    <section className="panel">
      <h3>
        Evidence behind the feedback
        <small className="muted">
          <Link to="/docs" hash="evidence-ladder">
            Docs
          </Link>
        </small>
      </h3>
      {ladderTotal > 0 ? (
        <div
          className="stack-bar"
          role="img"
          aria-label={report.ladder.map((rung) => `${rung.label}: ${rung.rows}`).join(', ')}
        >
          {report.ladder
            .filter((rung) => rung.rows > 0)
            .map((rung) => (
              <Hint
                key={rung.id}
                text={`${rung.label}: ${rung.rows} — ${rung.rule}`}
                docs="evidence-ladder"
              >
                <span style={{ flexGrow: rung.rows, background: LADDER_COLOR[rung.id] }} />
              </Hint>
            ))}
        </div>
      ) : null}
      <ul className="legend-list">
        {report.ladder.map((rung) => (
          <li key={rung.id}>
            <span className="swatch" style={{ background: LADDER_COLOR[rung.id] }} />
            <Hint text={rung.rule} docs="evidence-ladder">
              <span className="tip">{rung.label}</span>
            </Hint>
            <b>{rung.rows}</b>
          </li>
        ))}
      </ul>
      <ul className="meters">
        {coverage.map((entry) => (
          <li key={entry.label}>
            <Hint text={entry.rule} docs={entry.docs}>
              <span className="bar-label tip">{entry.label}</span>
            </Hint>
            <span className="bar-track" aria-hidden="true">
              <span style={{ width: `${entry.share * 100}%` }} />
            </span>
            <span className="bar-value">{formatPercent(entry.share)}</span>
            <span className="bar-note muted">
              {entry.n} of {stats.coverage.total}
            </span>
          </li>
        ))}
      </ul>
      <p className="muted note">
        The file rung counts a <code>feedbackURI</code>, not whether its payment proof or hash
        verifies. Those checks run per row in Tx detail.
      </p>
    </section>
  );
}
