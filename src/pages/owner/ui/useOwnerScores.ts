import { useEffect, useState } from 'react';
import {
  sourceFor,
  type AgentSummary,
  type ChainInfo,
  type ReputationSummary,
} from '../../../shared/lib/explorer';
import { getScores } from '../../../shared/lib/explorer';

type Scored = {
  items: AgentSummary[];
  scores: Map<bigint, ReputationSummary>;
};

/** Scores for the rows currently on screen; undefined while they are being read. */
export function useOwnerScores(chain: ChainInfo | undefined, items: AgentSummary[] | undefined) {
  const [state, setState] = useState<Scored>();
  const scores = state && state.items === items ? state.scores : undefined;

  useEffect(() => {
    let live = true;

    if (chain && items && items.length > 0) {
      const tokenIds = items.map((agent) => agent.tokenId);

      void sourceFor(chain)
        .then(({ rpcClient }) => getScores(rpcClient, chain, tokenIds))
        .then((result) => {
          if (live) setState({ items, scores: result });
        })
        .catch(() => {
          if (live) setState({ items, scores: new Map() });
        });
    }

    return () => {
      live = false;
    };
  }, [chain, items]);

  return scores;
}
