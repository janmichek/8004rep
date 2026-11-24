import type { AgentSummary, ChainInfo, ReputationSummary } from '../../../shared/lib/explorer';
import { ChainName } from '../../../shared/ui';
import { OwnerAgentsTable } from './OwnerAgentsTable';
import { OwnerPager } from './OwnerPager';
import type { OwnerOrder, OwnerSort } from './ownerSearch';

type Props = {
  items: AgentSummary[];
  chain: ChainInfo;
  scores: Map<bigint, ReputationSummary> | undefined;
  page: number;
  hasMore: boolean;
  sort: OwnerSort | null;
  order: OwnerOrder;
  activeSort: OwnerSort | null;
  canSortCreated: boolean;
  createdSort: OwnerOrder | null;
  slug: string;
  address: string;
  onSort: (next: OwnerSort) => void;
};

export function OwnerResults(props: Props) {
  return (
    <>
      {props.items.length === 0 ? (
        <section className="state muted">
          {props.page > 0 ? (
            <>No more agents on this page.</>
          ) : (
            <>
              This address owns no agents on{' '}
              <ChainName chainId={props.chain.chainId} name={props.chain.name} />.
            </>
          )}
        </section>
      ) : (
        <OwnerAgentsTable
          items={props.items}
          chain={props.chain}
          scores={props.scores}
          sort={props.sort}
          order={props.order}
          canSortCreated={props.canSortCreated}
          createdSort={props.createdSort}
          onSort={props.onSort}
        />
      )}
      <OwnerPager
        slug={props.slug}
        address={props.address}
        page={props.page}
        hasMore={props.hasMore}
        sort={props.sort}
        order={props.order}
        activeSort={props.activeSort}
      />
    </>
  );
}
