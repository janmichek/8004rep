import { queryOptions } from '@tanstack/react-query';
import { fetchAgents } from '../../../shared/api';

export const agentQueries = {
  all: () => ['agents'] as const,
  list() {
    return queryOptions({
      queryKey: [...agentQueries.all(), 'list'],
      queryFn: fetchAgents,
    });
  },
};
