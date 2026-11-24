import { Link } from '@tanstack/react-router';
import type { ReputationReport } from '../../../lib/explorer/data/reputation/report';
import { formatNumber, formatSigned } from '../../../lib/explorer';
import { Hint } from '../Hint';
import { barWidth, deltaClass, STEP_DOCS } from './waterfallMeta';

export function OverviewWaterfallPanel({ rep }: { rep: ReputationReport }) {
  return (
    <section className="panel">
      <h3>
        How the score is built
        <small className="muted">
          <Link to="/docs" hash="score">
            how it works
          </Link>
        </small>
      </h3>
      <ol className="bars waterfall">
        {rep.waterfall.map((step) => (
          <li key={step.id} className={step.id !== 'all' && step.rows === 0 ? 'idle' : undefined}>
            <Hint text={step.rule} docs={STEP_DOCS.get(step.id)}>
              <span className="bar-label tip">{step.label}</span>
            </Hint>
            <span className="bar-track" aria-hidden="true">
              <span style={{ width: barWidth(step.average) }} />
            </span>
            <span className="bar-value">{formatNumber(step.average)}</span>
            <span className={deltaClass(step.delta)}>
              {step.id === 'all' ? '' : formatSigned(step.delta)}
            </span>
            <span className="bar-note muted">
              {step.rows} row{step.rows === 1 ? '' : 's'}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
