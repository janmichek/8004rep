import { Fragment } from 'react';
import { Link } from '@tanstack/react-router';
import { KIND_INFO } from '../../../lib/explorer/data/reputation/kinds';
import type { ReputationReport } from '../../../lib/explorer/data/reputation/report';
import { Hint } from '../Hint';

export function OverviewKinds({ rep }: { rep: ReputationReport }) {
  const kinds = rep.byKind.filter((entry) => entry.rows > 0);

  return (
    <section className="panel">
      <h3>
        What the values mean
        <small className="muted">
          <Link to="/docs" hash="rating-only">
            only ratings are scored
          </Link>
        </small>
      </h3>
      <dl className="metric-list">
        {kinds.map((entry) => (
          <Fragment key={entry.kind}>
            <dt>
              <Hint
                text={KIND_INFO[entry.kind].rule}
                docs={entry.kind === 'telemetry' ? 'telemetry' : 'rating-only'}
              >
                <span className="tip">{entry.label}</span>
              </Hint>
            </dt>
            <dd>
              <b>{entry.rows}</b>
            </dd>
          </Fragment>
        ))}
      </dl>
      {rep.counts.outOfScale > 0 ? (
        <p className="muted note">
          {rep.counts.outOfScale} rating row{rep.counts.outOfScale === 1 ? '' : 's'} fall outside
          the scale inferred for the tag and are listed but not scored.{' '}
          <Link to="/docs" hash="off-scale">
            Docs
          </Link>
        </p>
      ) : null}
      {rep.counts.unknown > 0 ? (
        <p className="muted note">
          {rep.counts.unknown} row{rep.counts.unknown === 1 ? ' has' : 's have'} no tag or an
          unknown tag, so {rep.counts.unknown === 1 ? 'it is' : 'they are'} listed but not scored.
        </p>
      ) : null}
    </section>
  );
}
