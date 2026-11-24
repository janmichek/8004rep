import { useParams } from '@tanstack/react-router';
import { fetchScanAgentDetail, fetchScanChains, useAsync } from '../../../shared/lib/explorer';
import { AgentHeadSkeleton } from '../../../shared/ui';
import { ScanAgentDetail } from './ScanAgentDetail';

function parseChainId(value: string): number | undefined {
  return Number.isInteger(Number(value)) ? Number(value) : undefined;
}

function parseTokenId(value: string): bigint | undefined {
  return /^\d+$/.test(value) ? BigInt(value) : undefined;
}

// Agents on networks 8004rep has no chain config for: 8004scan's index is the record.
export function ScanAgentPage() {
  const { chainId: chainIdParam, id } = useParams({ from: '/scan/$chainId/$id' });
  const chainId = parseChainId(chainIdParam);
  const tokenId = parseTokenId(id);

  const chainsQuery = useAsync(fetchScanChains, []);
  const network = chainsQuery.data?.find((chain) => chain.chainId === chainId);

  const agentQuery = useAsync(async () => {
    if (chainId === undefined || tokenId === undefined) return null;

    return fetchScanAgentDetail(chainId, tokenId);
  }, [chainId, tokenId]);

  const scanUrl = `${network?.testnet ? 'https://testnet.8004scan.io' : 'https://8004scan.io'}/agents/${network?.key ?? chainId}/${id}`;

  if (agentQuery.error) {
    return (
      <section className="state">
        <p>Could not load agent: {agentQuery.error}</p>
        <button type="button" onClick={() => agentQuery.reload()}>
          Retry
        </button>
      </section>
    );
  }

  if (agentQuery.loading || agentQuery.data === undefined) {
    return <AgentHeadSkeleton />;
  }

  if (agentQuery.data === null) {
    return (
      <section className="state">
        <h1>Agent #{id} not found</h1>
        <p className="muted">8004scan has no record of this agent.</p>
      </section>
    );
  }

  return <ScanAgentDetail agent={agentQuery.data} id={id} network={network} scanUrl={scanUrl} />;
}
