import type { CheckGroup } from '../../lib/explorer/data/txChecks';
import { Hint } from './Hint';
import { STATUS_LABEL } from './txDetailView';

export function TxDetailGroups({ groups }: { groups: CheckGroup[] }) {
  return (
    <div className="tx-groups">
      {groups.map((group) => (
        <div key={group.id} className="tx-group">
          <h5>{group.title}</h5>
          <ul>
            {group.checks.map((check) => (
              <Hint key={check.id} text={check.rule}>
                <li>
                  <span className={`tx-status status-${check.status}`}>
                    {STATUS_LABEL[check.status]}
                  </span>
                  <span className="tx-check">
                    <b>{check.label}</b> {check.detail}
                  </span>
                </li>
              </Hint>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
