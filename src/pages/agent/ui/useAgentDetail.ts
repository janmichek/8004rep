import { useEffect, useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { findChainBySlug } from '../../../shared/lib/explorer';
import { sourceFor } from '../../../shared/lib/explorer';
import { resolveAgentURI, useAsync } from '../../../shared/lib/explorer';
import type { RegistrationFile } from '../../../shared/lib/explorer';

export function useAgentDetail() {
  const { slug, id } = useParams({ from: '/agents/$slug/$id' });
  const chain = findChainBySlug(slug);
  const tokenId = /^\d+$/.test(id) ? BigInt(id) : undefined;
  const agentQuery = useAsync(
    async () => {
      if (!chain || tokenId === undefined) return null;
      const { source } = await sourceFor(chain);
      return source.getAgent(tokenId);
    },
    [chain?.chainId, tokenId?.toString()]
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

  return { slug, id, chain, tokenId, agentQuery, file, setFile };
}
