import { sourceFor, type ChainInfo } from '../../lib/explorer';
import type { FeedbackStats } from '../../lib/explorer/data/feedbackStats';
import { buildReputationReport } from '../../lib/explorer/data/reputation/report';
import { evaluateTxDetail } from '../../lib/explorer/data/txChecks';
import { loadTxFacts } from '../../lib/explorer/data/txDetail';
import type { AgentDetail, Feedback } from '../../lib/explorer/data/types';
import { useAsync } from '../../lib/explorer/hooks/useAsync';
import { TxDetailBand } from './TxDetailBand';
import { TxDetailGroups } from './TxDetailGroups';
import { TxDetailHead } from './TxDetailHead';
import { TxDetailSkeleton } from './TxDetailSkeleton';
import { txContext } from './txDetailView';

type Props = {
  chain: ChainInfo;
  agent: AgentDetail;
  row: Feedback;
  index: number;
  stats: FeedbackStats;
};

export function TxDetail({ chain, agent, row, index, stats }: Props) {
  const facts = useAsync(async () => {
    const { source, rpcClient } = await sourceFor(chain);

    return loadTxFacts({
      chain,
      client: rpcClient,
      source,
      tokenId: agent.tokenId,
      row,
      feedback: agent.feedback,
    });
  }, [chain.chainId, agent.tokenId, index]);

  const self = [agent.owner, agent.agentWallet].filter(
    (address): address is NonNullable<typeof address> => address != null
  );

  const rep = buildReputationReport(agent.feedback, { self });

  const view = facts.data
    ? evaluateTxDetail(facts.data, txContext({ chain, agent, stats, rep, index }))
    : undefined;

  return (
    <section className="tx-detail" aria-label="Tx detail">
      <TxDetailHead chain={chain} facts={facts.data} hasView={Boolean(view)} />
      {facts.error ? (
        <p className="tx-detail-state">
          Could not load the tx detail: {facts.error}{' '}
          <button type="button" className="row-toggle" onClick={() => facts.reload()}>
            Retry
          </button>
        </p>
      ) : null}
      {!facts.error && (facts.loading || !view) ? <TxDetailSkeleton /> : null}
      {!facts.error && view ? (
        <>
          <TxDetailBand band={view.band} />
          <TxDetailGroups groups={view.groups} />
        </>
      ) : null}
    </section>
  );
}
