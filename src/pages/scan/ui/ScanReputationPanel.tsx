import { formatNumber, formatScore, type ScanAgentDetail } from '../../../shared/lib/explorer';

type Props = { agent: ScanAgentDetail };

export function ScanReputationPanel({ agent }: Props) {
  return (
    <section className="panel">
      <h3>Reputation</h3>
      <dl>
        <dt>8004scan score</dt>
        <dd>{formatNumber(agent.totalScore)}</dd>
        <dt>Average feedback</dt>
        <dd>{agent.feedbackCount ? formatScore(agent.averageScore) : '—'}</dd>
        <dt>Feedback</dt>
        <dd>{formatNumber(agent.feedbackCount, 0)}</dd>
      </dl>
    </section>
  );
}
