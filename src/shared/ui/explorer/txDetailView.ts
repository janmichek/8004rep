import type { ChainInfo } from '../../lib/explorer';
import type { FeedbackStats } from '../../lib/explorer/data/feedbackStats';
import type { ReputationReport } from '../../lib/explorer/data/reputation/report';
import type { AgentDetail } from '../../lib/explorer/data/types';
import type { CheckStatus, EvidenceBand, TxDetailContext } from '../../lib/explorer/data/txChecks';

const BAND_ORDER = ['pass', 'unknown', 'warn', 'missing', 'fail'] as const;

export const STATUS_LABEL: Record<CheckStatus, string> = {
  pass: 'pass',
  warn: 'warn',
  fail: 'fail',
  missing: 'absent',
  unknown: 'unknown',
  info: 'info',
};

export function txContext(args: {
  chain: ChainInfo;
  agent: AgentDetail;
  stats: FeedbackStats;
  rep: ReputationReport;
  index: number;
}): TxDetailContext {
  const { chain, agent, stats, rep, index } = args;

  const context: TxDetailContext = {
    chainId: chain.chainId,
    nativeSymbol: chain.viemChain.nativeCurrency.symbol,
    identity: chain.identity,
    reputation: chain.reputation,
    tokenId: agent.tokenId,
    owner: agent.owner,
    agentWallet: agent.agentWallet,
    feedback: agent.feedback,
    stats,
    rep,
    index,
  };

  if (agent.createdAt !== undefined) context.agentCreatedAt = agent.createdAt;

  return context;
}

export function bandSegments(band: EvidenceBand) {
  return BAND_ORDER.flatMap((status) => {
    const count = band[status];

    return count > 0 ? [{ status, count }] : [];
  });
}
