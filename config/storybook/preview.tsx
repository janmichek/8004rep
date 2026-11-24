import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Preview } from '@storybook/react-vite';
import '../../src/shared/lib/explorer/classic.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: Infinity } },
});

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
