import { Fragment } from 'react';
import type { ReputationReport } from '../../../lib/explorer/data/reputation/report';
import { formatNumber, formatPercent } from '../../../lib/explorer';

export function MethodsResponsiveness({ rep }: { rep: ReputationReport }) {
  return (
    <section className="panel">
      <h3>
        Responsiveness <small className="muted">how often a low rating gets an answer</small>
      </h3>
      <dl className="metric-list">
        <Fragment>
          <dt>Low ratings</dt>
          <dd>
            <b>{rep.responsiveness.lowRatings}</b> at or below half of their scale
          </dd>
        </Fragment>
        <Fragment>
          <dt>Answered</dt>
          <dd>
            <b>{formatPercent(rep.responsiveness.share)}</b> of them carry a response
          </dd>
        </Fragment>
        <Fragment>
          <dt>Median lag</dt>
          <dd>
            {rep.responsiveness.medianLagDays === null
              ? '—'
              : `${formatNumber(rep.responsiveness.medianLagDays)} days`}
          </dd>
        </Fragment>
        <Fragment>
          <dt>Who replies</dt>
          <dd>
            {rep.responsiveness.ownerReplies} from the owner or agent wallet,{' '}
            {rep.responsiveness.thirdPartyReplies} from anyone else
          </dd>
        </Fragment>
      </dl>
    </section>
  );
}
