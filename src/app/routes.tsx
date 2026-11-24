import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { OverviewPage } from '../pages/overview';
import { AgentsPage } from '../pages/agents';
import { Layout } from './Layout';

const rootRoute = createRootRoute({ component: Layout });

const overviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: OverviewPage,
});

const agentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/agents/{-$agentId}',
  component: AgentsPage,
});

export const router = createRouter({
  routeTree: rootRoute.addChildren([overviewRoute, agentsRoute]),
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
