import { formatNumber, formatScore, type IndexedAgent } from '../../../../shared/lib/explorer';

type Props = { agent: IndexedAgent };

function intervalTitle(agent: IndexedAgent): string {
  const wallets = `${agent.uniqueWallets} wallet${agent.uniqueWallets === 1 ? '' : 's'}`;

  if (agent.ciLow === null || agent.ciHigh === null) {
    return `rep-1.0 ${agent.confidence} confidence · ${wallets} · too few units for an interval`;
  }

  return `rep-1.0 ${agent.confidence} confidence · 80% interval ${formatNumber(agent.ciLow)}–${formatNumber(agent.ciHigh)} · ${wallets}`;
}

export function AgentScoreCell({ agent }: Props) {
  if (agent.unrated || agent.score === null) {
    return (
      <td className="score-cell">
        <span className="score-label muted">Unrated</span>
        <span className="muted score-note">no ratings</span>
      </td>
    );
  }

  const score = Math.max(0, Math.min(100, agent.score));

  return (
    <td className="score-cell" title={intervalTitle(agent)}>
      <span className="score-label">{formatScore(Math.round(score * 10) / 10)}</span>
      <span className="chip score-confidence">{agent.confidence}</span>
      <span className="score-track" aria-hidden="true">
        <span className="score-fill" style={{ width: `${score}%` }} />
      </span>
    </td>
  );
}
