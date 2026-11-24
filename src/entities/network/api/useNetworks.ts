import { useQuery } from '@tanstack/react-query';
import { networkQueries } from './networkQueries';

// Stable entity hook around networkQueries.list() - keeps UI decoupled
// from query options so params/select/enabled can be added later.
export function useNetworks() {
  return useQuery(networkQueries.list());
}
