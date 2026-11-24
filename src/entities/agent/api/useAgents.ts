import { useQuery } from '@tanstack/react-query';
import { agentQueries } from './agentQueries';

// Stable entity hook around agentQueries.list() - keeps UI decoupled
// from query options so params/select/enabled can be added later.
export function useAgents() {
  return useQuery(agentQueries.list());
}
