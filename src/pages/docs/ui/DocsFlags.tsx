import { Fragment } from 'react';
import { FLAG_INFO, type RowFlag } from '../../../shared/lib/explorer';
import { FlagChip } from '../../../shared/ui';

const FLAG_IDS = [
  'revoked',
  'self',
  'duplicate',
  'burst',
  'monotonous',
  'hyperactive',
  'outlier',
  'out-of-range',
  'unlisted-endpoint',
] satisfies readonly RowFlag[];

export function DocsFlags() {
  return (
    <dl className="metric-list">
      {FLAG_IDS.map((id) => (
        <Fragment key={id}>
          <dt>
            <FlagChip flag={id} />
          </dt>
          <dd>{FLAG_INFO[id].rule}</dd>
        </Fragment>
      ))}
    </dl>
  );
}
