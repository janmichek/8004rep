import { Fragment } from 'react';
import type { ReputationReport } from '../../../lib/explorer/data/reputation/report';
import { formatNumber } from '../../../lib/explorer';

export function MethodsParameters({ rep }: { rep: ReputationReport }) {
  return (
    <section className="panel">
      <h3>Parameters</h3>
      <dl className="metric-list">
        <Fragment>
          <dt>Unit window</dt>
          <dd>{rep.params.unitWindowDays} days</dd>
        </Fragment>
        <Fragment>
          <dt>Half-life</dt>
          <dd>{rep.params.halfLifeDays} days</dd>
        </Fragment>
        <Fragment>
          <dt>Prior</dt>
          <dd>
            {rep.params.alpha0} wallets at {formatNumber(rep.params.mu0 * 100)}/100
          </dd>
        </Fragment>
        <Fragment>
          <dt>Formula</dt>
          <dd>
            <code>{rep.formulaVersion}</code>
          </dd>
        </Fragment>
      </dl>
    </section>
  );
}
