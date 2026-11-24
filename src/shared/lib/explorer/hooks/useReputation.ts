import { useMemo } from 'react';
import { Gauge, GitCompareArrows, IdCard, MessageSquare, Users } from 'lucide-react';
import type { ChainInfo } from '../chains';
import type { AgentDetail, RegistrationFile } from '../data/types';
import { computeFeedbackStats } from '../data/feedbackStats';
import { buildReputationReport, type ReputationReport } from '../data/reputation/report';
import { buildTrustReport } from '../data/trustReport';
import { fetchScanScore } from '../data/scan';
import { formatNumber, formatPercent } from '../format';
import type { Tile } from '../../../ui/explorer/tileTypes';
import { useAsync } from './useAsync';

const CONFIDENCE_TONE: Record<ReputationReport['confidence'], Tile['tone']> = {
  low: 'warn',
  medium: undefined,
  high: 'good',
};
const CONFIDENCE_STEPS: Record<ReputationReport['confidence'], number> = {
  low: 1,
  medium: 2,
  high: 3,
};
const LEVEL: Record<string, { word: string; tone: Tile['tone']; severity: number }> = {
  high: { word: 'high risk', tone: 'bad', severity: 3 },
  warn: { word: 'needs a look', tone: 'warn', severity: 2 },
  info: { word: 'notes only', tone: undefined, severity: 1 },
  clean: { word: 'no findings', tone: 'good', severity: 0 },
};

export function useReputation(
  agent: AgentDetail,
  chain: ChainInfo,
  file: RegistrationFile | null | undefined
) {
  const self = [agent.owner, agent.agentWallet].filter(
    (address): address is NonNullable<typeof address> => address != null
  );
  const stats = useMemo(
    () =>
      computeFeedbackStats(agent.feedback, {
        owner: agent.owner,
        agentWallet: agent.agentWallet,
        ...(file ? { services: file.services.map((service) => service.endpoint) } : {}),
      }),
    [agent.feedback, agent.owner, agent.agentWallet, file]
  );
  const report = useMemo(
    () => buildTrustReport(agent.feedback, stats, self),
    [agent.feedback, stats, self]
  );
  const rep = useMemo(
    () => buildReputationReport(agent.feedback, { self }),
    [agent.feedback, self]
  );
  const scan = useAsync(
    () => fetchScanScore(chain.chainId, agent.tokenId),
    [chain.chainId, agent.tokenId]
  );

  const tiles = useMemo<Tile[]>(() => {
    const onchain = agent.reputation;
    const scanScore = scan.data;
    const rawValue = onchain?.average ?? rep.raw;
    const rawGap =
      rawValue !== null && rawValue !== undefined && rep.score !== null
        ? rawValue - rep.score
        : null;
    const interval = rep.interval
      ? `80% interval ${formatNumber(rep.interval[0])}–${formatNumber(rep.interval[1])}`
      : 'too few rating units for an interval';
    return [
      {
        label: 'Filtered score',
        value: rep.unrated ? 'Unrated' : formatNumber(rep.score),
        hint: rep.unrated ? 'no rating rows' : interval,
        title: rep.unrated
          ? 'No review here is a rating. Telemetry, outcomes and quantities are listed, never averaged into a score.'
          : `One vote per wallet, ratings only, neutral prior of ${rep.params.alpha0} wallets. ${rep.confidence} confidence.`,
        tone: rep.unrated ? 'quiet' : 'main',
        word: rep.unrated,
        meter: rep.unrated ? undefined : { kind: 'gauge', value: rep.score, band: rep.interval },
      },
      {
        label: 'Confidence',
        value: rep.confidence,
        hint: `${rep.funnel.wallets} wallet${rep.funnel.wallets === 1 ? '' : 's'} · ${rep.funnel.units} unit${rep.funnel.units === 1 ? '' : 's'}`,
        title: `${formatNumber(rep.concentration.neff)} effective voices; the largest wallet holds ${formatPercent(rep.concentration.top1)} of the weight.`,
        tone: CONFIDENCE_TONE[rep.confidence],
        word: true,
        meter: { kind: 'steps', filled: CONFIDENCE_STEPS[rep.confidence], total: 3 },
      },
      {
        label: 'Risk',
        value: LEVEL[stats.level]?.word ?? 'no findings',
        hint: stats.signals.length
          ? `${stats.signals.length} signal${stats.signals.length === 1 ? '' : 's'}`
          : 'nothing flagged',
        title: 'Worst level among the signals on the Overview tab',
        tone: LEVEL[stats.level]?.tone,
        word: true,
        meter: { kind: 'severity', level: LEVEL[stats.level]?.severity ?? 0, max: 3 },
      },
      {
        label: 'Raw on-chain',
        value: formatNumber(rawValue),
        hint: [
          `n = ${onchain?.count ?? stats.coverage.total}${onchain?.capped ? ' (capped)' : ''}`,
          rawGap !== null && rawGap > 0.5 ? `+${formatNumber(rawGap)} vs filtered` : '',
          rep.counts.unknown ? `${rep.counts.unknown} unclassified not scored` : '',
        ]
          .filter(Boolean)
          .join(' · '),
        title:
          "Plain mean of non-revoked rows: the registry's getSummary on RPC networks, or the mean of the rows loaded from an indexer. It mixes ratings with telemetry and quantities, so it is a baseline, not a quality score. Untagged or unknown-tag rows are listed but cannot be classified or scored.",
        meter:
          rawValue === null || rawValue === undefined
            ? undefined
            : { kind: 'gauge', value: rawValue },
      },
      {
        label: '8004scan',
        value: scanScore ? formatNumber(scanScore.total) : '—',
        hint: scan.error
          ? 'unreachable'
          : scanScore?.feedback
            ? `its feedback avg ${formatNumber(scanScore.feedback.average)}`
            : scan.loading
              ? ''
              : 'not scored there',
        title: "8004scan's overall score, read live from its public API — see the vs 8004scan tab",
        tone: 'quiet',
        loading: scan.loading,
        meter: scanScore ? { kind: 'gauge', value: scanScore.total } : undefined,
      },
    ];
  }, [agent.reputation, rep, stats, scan.data, scan.error, scan.loading]);

  const tabs = useMemo(
    () => [
      { id: 'overview', label: 'Overview', icon: Gauge },
      { id: 'feedback', label: 'Feedback', icon: MessageSquare, count: agent.feedback.length },
      {
        id: 'reviewers',
        label: 'Reviewers',
        icon: Users,
        count: stats.reviewers.length,
        ...(stats.signals.some(
          (signal) => signal.code === 'concentration' || signal.code === 'self'
        )
          ? { tone: 'warn' as const }
          : {}),
      },
      { id: 'identity', label: 'Identity', icon: IdCard },
      { id: 'methods', label: 'Methods', icon: BookOpenIcon },
      { id: 'compare', label: 'vs 8004scan', icon: GitCompareArrows },
    ],
    [agent.feedback.length, stats.reviewers.length, stats.signals]
  );

  return { self, stats, report, rep, scan, tiles, tabs };
}

// Kept local so the tab list stays in one place; same icon family as the old Vue import.
import { BookOpen as BookOpenIcon } from 'lucide-react';
