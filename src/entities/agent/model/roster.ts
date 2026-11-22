import type { Agent } from '@shared/schemas';

// Business rules for the agent roster, kept out of the UI so they can be unit and mutation tested.
export function byNetwork(agents: Agent[], network: string | undefined): Agent[] {
  return network === undefined ? agents : agents.filter((agent) => agent.network === network);
}

export function countByStatus(agents: Agent[]): Record<Agent['status'], number> {
  const counts = { active: 0, quiet: 0, unreviewed: 0 };

  for (const agent of agents) counts[agent.status] += 1;

  return counts;
}

// Mean of known scores only; agents without a score do not pull the average down.
export function averageScore(agents: Agent[]): number | null {
  const scored = agents.filter((agent): agent is Agent & { score: number } => agent.score !== null);

  if (scored.length === 0) return null;

  return scored.reduce((sum, agent) => sum + agent.score, 0) / scored.length;
}
