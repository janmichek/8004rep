import { queryOptions } from '@tanstack/react-query';
import { fetchNetworks } from '../../../shared/api';

export const networkQueries = {
  list() {
    return queryOptions({
      queryKey: ['networks', 'list'],
      queryFn: fetchNetworks,
    });
  },
};
