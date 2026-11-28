import type { IndexedAgent, IndexedAgentPage } from '../../../shared/lib/explorer';
import type { Network } from '@shared/schemas';
import { TableSkeleton } from '../../../shared/ui';
import { AgentList } from './AgentList';
import { AgentsError } from './AgentsError';
import { AgentsPager } from './AgentsPager';

type Props = {
  error?: string | undefined;
  loading: boolean;
  pinned: IndexedAgent[];
  feed: IndexedAgent[];
  hasRows: boolean;
  q: string;
  rated: boolean;
  page: number;
  sort: 'registered' | 'score' | 'feedback' | null;
  order: 'asc' | 'desc';
  slug: string;
  chainQuery: number | undefined;
  data?: IndexedAgentPage | undefined;
  chains: Map<number, Network>;
  registeredSort: 'asc' | 'desc' | null;
  scoreSort: 'asc' | 'desc' | null;
  feedbackSort: 'asc' | 'desc' | null;
  onSort: (next: 'registered' | 'score' | 'feedback') => void;
  onRetry: () => void;
};

export function AgentsResults(props: Props) {
  if (props.error) return <AgentsError error={props.error} onRetry={props.onRetry} />;

  if (props.loading) {
    return (
      <TableSkeleton
        label="Loading agents"
        headers={['Agent', 'ID', 'Chain', 'Services', 'Score', 'Feedback', 'Owner', 'Registered']}
        numeric={['ID', 'Feedback', 'Registered']}
      />
    );
  }

  if (!props.hasRows) {
    return (
      <section className="state muted">
        {props.q ? `No agent matches “${props.q}”.` : 'No agents registered yet.'}
      </section>
    );
  }

  return (
    <>
      <AgentList
        pinned={props.pinned}
        feed={props.feed}
        chains={props.chains}
        registeredSort={props.registeredSort}
        scoreSort={props.scoreSort}
        feedbackSort={props.feedbackSort}
        onSort={props.onSort}
      />
      <AgentsPager
        rated={props.rated}
        page={props.page}
        hasMore={Boolean(props.data?.hasMore)}
        sort={props.sort}
        slug={props.slug}
        q={props.q}
        chain={props.chainQuery}
        order={props.order}
      />
    </>
  );
}
