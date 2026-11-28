import { useSort, type OwnerEntry } from '../../../shared/lib/explorer';
import { SortHeader } from '../../../shared/ui';
import { OwnerRow } from './OwnerRow';

type Props = {
  owners: OwnerEntry[];
  slug: string;
  showNetworks: boolean;
};

export function OwnersTable({ owners, slug, showNetworks }: Props) {
  const rows = useSort(owners, [
    { key: 'owner', value: (owner) => owner.owner.toLowerCase() },
    { key: 'agents', value: (owner) => owner.agents, numeric: true },
    { key: 'latest', value: (owner) => owner.latest.tokenId, numeric: true },
  ]);

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <SortHeader
              label="Owner"
              active={rows.state('owner')}
              onSort={() => rows.toggle('owner')}
            />
            <SortHeader
              label="Agents"
              numeric
              active={rows.state('agents')}
              onSort={() => rows.toggle('agents')}
            />
            <th>Scale</th>
            {showNetworks ? <th>Networks</th> : null}
            <SortHeader
              label="Newest agent"
              numeric
              active={rows.state('latest')}
              onSort={() => rows.toggle('latest')}
            />
          </tr>
        </thead>
        <tbody>
          {rows.sorted.map((owner) => (
            <OwnerRow key={owner.owner} owner={owner} slug={slug} showNetworks={showNetworks} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
