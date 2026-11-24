import type { Agent } from '@shared/schemas';
import { formatScore } from '../../../shared/lib';
import { AgentStatusBadge } from './AgentStatusBadge';

export function AgentFacts({ agent }: { agent: Agent }) {
  return (
    <dl className="facts">
      <dt>ID</dt>
      <dd>{agent.id}</dd>
      <dt>Owner</dt>
      <dd>{agent.owner}</dd>
      <dt>Feedback</dt>
      <dd>{agent.feedbackCount}</dd>
      <dt>Score</dt>
      <dd>{agent.score === null ? '—' : formatScore(agent.score)}</dd>
      <dt>Status</dt>
      <dd>
        <AgentStatusBadge status={agent.status} />
      </dd>
      <dt>Registered</dt>
      <dd>{new Date(agent.registeredAt).toLocaleDateString()}</dd>
    </dl>
  );
}
