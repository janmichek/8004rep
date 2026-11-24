import { Fragment } from 'react';
import type { ReputationReport } from '../../../lib/explorer/data/reputation/report';
import { StatTiles } from '../StatTiles';
import { alternativesFor, concentrationMetrics } from './methodsData';

export function MethodsAlternatives({ rep }: { rep: ReputationReport }) {
  return (
    <section className="panel">
      <h3>How the score is built</h3>
      <StatTiles tiles={alternativesFor(rep)} />
      <dl className="metric-list">
        {concentrationMetrics(rep).map((metric) => (
          <Fragment key={metric.label}>
            <dt>{metric.label}</dt>
            <dd>
              <b>{metric.value}</b> <small className="muted">{metric.rule}</small>
            </dd>
          </Fragment>
        ))}
      </dl>
    </section>
  );
}
