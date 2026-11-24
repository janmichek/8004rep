import { useEffect, useState } from 'react';
import { findChainBySlug } from '../chains';
import { sourceFor } from '../data';
import { computeFeedbackStats } from '../data/feedbackStats';
import { resolveAgentURI } from '../data/metadata';
import { useAsync } from './useAsync';
import type { RegistrationFile } from '../data/types';

export function useFeedbackDetail(slug: string, id: string, index: string) {
  const chain = findChainBySlug(slug);
  const tokenId = /^\d+$/.test(id) ? BigInt(id) : undefined;
  const rowIndex = /^\d+$/.test(index) ? Number(index) : undefined;
  const agentQuery = useAsync(async () => {
    if (!chain || tokenId === undefined) return null;
    const { source } = await sourceFor(chain);
    return source.getAgent(tokenId);
  }, [chain?.chainId, tokenId?.toString()]);
  const [file, setFile] = useState<RegistrationFile | null | undefined>(undefined);

  useEffect(() => {
    let live = true;
    setFile(undefined);
    const current = agentQuery.data;
    if (!current)
      return () => {
        live = false;
      };
    void resolveAgentURI(current.agentURI).then((resolved) => {
      if (live) setFile(resolved ?? current.file ?? null);
    });
    return () => {
      live = false;
    };
  }, [agentQuery.data]);

  const agent = agentQuery.data;
  const row = rowIndex === undefined ? undefined : agent?.feedback[rowIndex];
  const stats =
    agent && file !== undefined
      ? computeFeedbackStats(agent.feedback, {
          owner: agent.owner,
          agentWallet: agent.agentWallet,
          ...(file ? { services: file.services.map((service) => service.endpoint) } : {}),
        })
      : undefined;

  return { chain, id, index, tokenId, rowIndex, agentQuery, agent, file, row, stats };
}
