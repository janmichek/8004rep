import { Fragment } from 'react';
import { LABEL_INFO, type ReviewerLabel } from '../../../shared/lib/explorer';
import { ReviewerChip } from '../../../shared/ui';

const LABEL_IDS = [
  'rubber-stamp',
  'single-agent',
  'bulk',
  'mass',
  'harsh',
] satisfies readonly ReviewerLabel[];

export function DocsLabels() {
  return (
    <dl className="metric-list">
      {LABEL_IDS.map((id) => (
        <Fragment key={id}>
          <dt>
            <ReviewerChip label={id} />
          </dt>
          <dd>{LABEL_INFO[id].rule}</dd>
        </Fragment>
      ))}
    </dl>
  );
}
