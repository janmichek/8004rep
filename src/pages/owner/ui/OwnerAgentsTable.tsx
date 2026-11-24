import type { AgentSummary, ChainInfo, ReputationSummary } from '../../../shared/lib/explorer';
import { Hint, SortHeader } from '../../../shared/ui';
import { AgentRow } from './AgentRow';
import type { OwnerOrder, OwnerSort } from './ownerSearch';

type Props = {
  items: AgentSummary[];
  chain: ChainInfo;
  scores: Map<bigint, ReputationSummary> | undefined;
  sort: OwnerSort | null;
  order: OwnerOrder;
  canSortCreated: boolean;
  createdSort: OwnerOrder | null;
  onSort: (next: OwnerSort) => void;
};

export function OwnerAgentsTable({
  items,
  chain,
  scores,
  sort,
  order,
  canSortCreated,
  createdSort,
  onSort,
}: Props) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Agent</th>
            <SortHeader
              label="ID"
              numeric
              active={sort === 'id' ? order : null}
              onSort={() => onSort('id')}
            />
            <th>Services</th>
            <Hint text="Count and average of all feedback values, any tag">
              <th className="num">Feedback</th>
            </Hint>
            {canSortCreated ? (
              <SortHeader
                label="Created"
                numeric
                active={createdSort}
                onSort={() => onSort('created')}
              />
            ) : (
              <th className="num">Created</th>
            )}
          </tr>
        </thead>
        <tbody>
          {items.map((agent) => (
            <AgentRow
              key={`${agent.chainId}:${agent.tokenId.toString()}`}
              agent={agent}
              chain={chain}
              score={scores?.get(agent.tokenId)}
              scoreLoading={scores === undefined}
              hideOwner
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
