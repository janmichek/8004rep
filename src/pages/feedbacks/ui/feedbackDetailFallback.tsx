import type { ReactNode } from 'react';
import type { ChainInfo } from '../../../shared/lib/explorer';
import type { AgentDetail } from '../../../shared/lib/explorer';
import type { useFeedbackDetail } from '../../../shared/lib/explorer';
import { ChainName, Skeleton } from '../../../shared/ui';

type Query = ReturnType<typeof useFeedbackDetail>['agentQuery'];

function errorState(query: Query): ReactNode {
  if (!query.error) return undefined;

  return (
    <section className="state">
      <p>Could not load feedback: {query.error}</p>
      <button type="button" onClick={() => query.reload()}>
        Retry
      </button>
    </section>
  );
}

function loadingState(): ReactNode {
  return (
    <section className="state" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading feedback</span>
      <div className="skeleton-stack">
        <Skeleton width="18em" height="1.35em" />
        <Skeleton width="28em" height="0.9em" />
        <Skeleton block width="92%" height="9em" />
      </div>
    </section>
  );
}

function missingAgent(chain: ChainInfo, id: string): ReactNode {
  return (
    <section className="state">
      <h1>Agent #{id} not found</h1>
      <p className="muted">
        No such token in the <ChainName chainId={chain.chainId} name={chain.name} /> identity
        registry.
      </p>
    </section>
  );
}

export function feedbackDetailFallback(args: {
  query: Query;
  chain: ChainInfo | undefined;
  agent: AgentDetail | null | undefined;
  id: string;
}): ReactNode {
  const error = errorState(args.query);

  if (error) return error;

  if (args.query.loading || args.agent === undefined) return loadingState();

  if (!args.chain) return null;

  if (args.agent === null) return missingAgent(args.chain, args.id);

  return undefined;
}
