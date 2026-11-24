import { Link } from '@tanstack/react-router';
import type { ChainInfo } from '../../../shared/lib/explorer';
import { formatNumber, useSort } from '../../../shared/lib/explorer';
import type { AgentActivity } from '../../../shared/lib/explorer';
import { SortHeaderRow } from '../../../shared/ui';

export function NetworkAgents({ rows, chain }: { rows: AgentActivity[]; chain: ChainInfo }) {
  const { sorted, state, toggle } = useSort(rows, [
    { key: 'agent', value: (row) => row.agentName ?? `Agent #${row.tokenId}` },
    { key: 'reviews', value: (row) => row.rows, numeric: true },
    { key: 'reviewers', value: (row) => row.reviewers, numeric: true },
    { key: 'average', value: (row) => row.average, numeric: true },
  ]);

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <SortHeaderRow
            columns={[
              { key: 'agent', label: 'Agent' },
              { key: 'reviews', label: 'Feedback', numeric: true },
              { key: 'reviewers', label: 'Reviewers', numeric: true },
              { key: 'average', label: 'Avg rating', numeric: true },
            ]}
            state={state}
            toggle={toggle}
          />
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={row.tokenId.toString()} className="row-link" role="link" tabIndex={0}>
              <td>
                <Link
                  to="/agents/$slug/$id"
                  params={{ slug: chain.slug, id: row.tokenId.toString() }}
                  className="row-title"
                >
                  {row.agentName ?? `Agent #${row.tokenId.toString()}`}
                </Link>{' '}
                <small className="muted">#{row.tokenId.toString()}</small>
              </td>
              <td className="num">{row.rows}</td>
              <td className={`num${row.reviewers === 1 && row.rows > 2 ? ' warnText' : ''}`}>
                {row.reviewers}
              </td>
              <td className="num">{formatNumber(row.average)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
