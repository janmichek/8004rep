import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Preview } from '@storybook/react-vite';
import { networks } from '../../server/data';
import { networkQueries } from '../../src/entities/network';
import '../../src/index.css';

// no API in a static Storybook build (Chromatic), so the cache is seeded and never refetched
const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });

queryClient.setQueryData(networkQueries.list().queryKey, networks);

const preview: Preview = {
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <Story />
      </QueryClientProvider>
    ),
  ],
};

export default preview;
