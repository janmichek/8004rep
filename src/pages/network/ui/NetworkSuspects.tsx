import { Link } from '@tanstack/react-router';
import type { ChainInfo } from '../../../shared/lib/explorer';
import { formatNumber, shortAddress, useSort } from '../../../shared/lib/explorer';
import type { SuspectReviewer } from '../../../shared/lib/explorer';
import { LABEL_INFO } from '../../../shared/lib/explorer';
import { AddressIdenticon, Hint, ReviewerChip, SortHeader } from '../../../shared/ui';

export function NetworkSuspects({ rows, chain }: { rows: SuspectReviewer[]; chain: ChainInfo }) {
  const { sorted, state, toggle } = useSort(rows, [
    { key: 'reviewer', value: (row) => row.client },
    { key: 'reviews', value: (row) => row.rows, numeric: true },
    { key: 'agents', value: (row) => row.agents, numeric: true },
    { key: 'average', value: (row) => row.average, numeric: true },
  ]);

  if (rows.length === 0)
    return <p className="muted">No reviewer in this window trips a reviewer rule.</p>;

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <SortHeader
              label="Reviewer"
              active={state('reviewer')}
              onSort={() => toggle('reviewer')}
            />
            <SortHeader
              label="Reviews"
              numeric
              active={state('reviews')}
              onSort={() => toggle('reviews')}
            />
            <SortHeader
              label="Agents"
              numeric
              active={state('agents')}
              onSort={() => toggle('agents')}
            />
            <SortHeader
              label="Avg rating"
              numeric
              active={state('average')}
              onSort={() => toggle('average')}
            />
            <th>Why</th>
          </tr>
        </thead>
        <tbody>
          {sorted.slice(0, 50).map((row) => (
            <tr key={row.client} className="row-link" role="link" tabIndex={0}>
              <td>
                <Link
                  to="/reviewers/$slug/$address"
                  params={{ slug: chain.slug, address: row.client }}
                  className="address-mark mono"
                  title={row.client}
                >
                  <AddressIdenticon address={row.client} />
                  {shortAddress(row.client)}
                </Link>
              </td>
              <td className="num">{row.rows}</td>
              <td className="num">{row.agents}</td>
              <td className="num">{formatNumber(row.average)}</td>
              <td>
                {row.labels.map((label) => (
                  <Hint key={label} text={LABEL_INFO[label].rule}>
                    <ReviewerChip label={label} />
                  </Hint>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
