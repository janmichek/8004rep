import type { ChainInfo } from '../../../shared/lib/explorer';
import { TableSkeleton } from '../../../shared/ui';
import { OwnerResults } from './OwnerResults';
import type { OwnerAgentState } from './useOwnerAgents';

type Props = {
  owner: OwnerAgentState;
  chain: ChainInfo;
  address: string;
};

export function OwnerStatus({ owner, chain, address }: Props) {
  return (
    <>
      {owner.error ? (
        <section className="state">
          <p>Could not load agents: {owner.error}</p>
          <button type="button" onClick={owner.reload}>
            Retry
          </button>
        </section>
      ) : null}

      {!owner.error && (owner.loading || !owner.data) ? (
        <TableSkeleton
          label="Loading agents"
          headers={['Agent', 'ID', 'Services', 'Feedback', 'Created']}
          numeric={['ID', 'Feedback', 'Created']}
        />
      ) : null}

      {!owner.error && owner.data && !owner.loading ? (
        <OwnerResults
          items={owner.data.items}
          chain={chain}
          scores={owner.scores}
          page={owner.page}
          hasMore={owner.data.hasMore}
          sort={owner.sort}
          order={owner.order}
          activeSort={owner.activeSort}
          canSortCreated={owner.canSortCreated}
          createdSort={owner.createdSort}
          slug={owner.slug}
          address={address}
          onSort={owner.toggleSort}
        />
      ) : null}
    </>
  );
}
