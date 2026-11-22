import type { Agent } from '@shared/schemas';

export function AgentStatusBadge({ status }: { status: Agent['status'] }) {
  return <span className={`badge badge--${status}`}>{status}</span>;
}
