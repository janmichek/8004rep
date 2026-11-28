import { useMemo } from 'react';
import {
  findMetadataClones,
  resolveAgentURI,
  useAsync,
  type AgentSummary,
} from '../../../shared/lib/explorer';

/**
 * Registration files for the current owner page, compared for near-identical
 * text. Bounded by the page size (25) and the shared fetch cache.
 */
export function useOwnerClones(items: AgentSummary[] | undefined) {
  const files = useAsync(async () => {
    if (!items || items.length < 2) return [];

    return Promise.all(
      items.map(async (agent) => ({
        tokenId: agent.tokenId,
        file: await resolveAgentURI(agent.agentURI),
      }))
    );
  }, [items]);

  const clones = useMemo(() => (files.data ? findMetadataClones(files.data) : []), [files.data]);

  return { clones, loading: files.loading };
}
