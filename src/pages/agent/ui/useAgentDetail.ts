import { useEffect, useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { findChainBySlug } from '../../../shared/lib/explorer';
import { indexToAgent, sourceFor } from '../../../shared/lib/explorer';
import { resolveAgentURI, useAsync } from '../../../shared/lib/explorer';
import type { RegistrationFile } from '../../../shared/lib/explorer';
import { fetchAgentDetail } from '../../../shared/api';

export function useAgentDetail() {
  const { slug, id } = useParams({ from: '/agents/$slug/$id' });
  const chain = findChainBySlug(slug);
  const tokenId = /^\d+$/.test(id) ? BigInt(id) : undefined;
  const indexedQuery = useAsync(
    async () => {
      if (!chain || tokenId === undefined) return null;

      try {
        return indexToAgent(await fetchAgentDetail(chain.chainId, tokenId.toString()));
      } catch {
        return null;
      }
    },
    [chain?.chainId, tokenId?.toString()]
  );
  const agentQuery = useAsync(
    async () => {
      if (!chain || tokenId === undefined) return null;
      if (indexedQuery.data) return indexedQuery.data.agent;
      const { source } = await sourceFor(chain);

      return source.getAgent(tokenId);
    },
    [chain?.chainId, tokenId?.toString(), indexedQuery.data]
  );
  const [file, setFile] = useState<RegistrationFile | null | undefined>(undefined);

  useEffect(() => {
    let live = true;
    setFile(undefined);
    const current = agentQuery.data;
    if (!current) return;
    void resolveAgentURI(current.agentURI).then((resolved) => {
      if (live) setFile(resolved ?? current.file ?? null);
    });

    return () => {
      live = false;
    };
  }, [agentQuery.data]);

  return {
    slug,
    id,
    chain,
    tokenId,
    agentQuery,
    file,
    setFile,
    tagScales: indexedQuery.data?.tagScales,
  };
}
