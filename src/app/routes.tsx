import { createRootRoute, createRoute, createRouter, redirect } from '@tanstack/react-router';
import { z } from 'zod';
import { AgentPage } from '../pages/agent';
import { AgentsPage } from '../pages/agents';
import { DocsPage } from '../pages/docs';
import { FeedbackDetailPage } from '../pages/feedbacks';
import { FeedbacksPage } from '../pages/feedbacks';
import { NetworkPage } from '../pages/network';
import { OwnerPage } from '../pages/owner';
import { OwnersPage } from '../pages/owners';
import { ReviewerPage } from '../pages/reviewer';
import { ReviewersPage } from '../pages/reviewers';
import { ScanAgentPage } from '../pages/scan';
import { StarredPage } from '../pages/starred';
import { ALL_NETWORKS, findChainBySlug } from '../shared/lib/explorer';
import { Layout } from './Layout';

const ratedInput = z.union([
  z.literal('1'),
  z.literal(1),
  z.literal(true),
  z.literal(false),
  z.literal('0'),
  z.literal(0),
]);

const agentsSearchSchema = z.object({
  q: z.string().optional(),
  chain: z.coerce.number().optional(),
  page: z.coerce.number().optional(),
  sort: z.enum(['registered', 'score', 'feedback']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  rated: ratedInput.optional().transform((value) => {
    if (value === undefined) return undefined;

    return value === '1' || value === 1 || value === true;
  }),
});

const pageSearchSchema = z.object({
  page: z.coerce.number().optional(),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional(),
  tab: z.string().optional(),
});

function scopeGuard(slug: string, list: 'agents' | 'owners' | 'reviewers' | 'feedbacks') {
  if (slug === ALL_NETWORKS || findChainBySlug(slug)) return;
  throw redirect({ to: `/${list}/$slug`, params: { slug: ALL_NETWORKS } });
}

function chainGuard(slug: string, list: 'agents' | 'owners' | 'reviewers') {
  if (findChainBySlug(slug)) return;
  throw redirect({ to: `/${list}/$slug`, params: { slug: ALL_NETWORKS } });
}

const rootRoute = createRootRoute({ component: Layout });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/agents/$slug', params: { slug: ALL_NETWORKS } });
  },
});

const agentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/agents/$slug',
  component: AgentsPage,
  validateSearch: agentsSearchSchema,
  beforeLoad: ({ params }) => scopeGuard(params.slug, 'agents'),
});

const agentRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/agents/$slug/$id',
  component: AgentPage,
  beforeLoad: ({ params }) => chainGuard(params.slug, 'agents'),
});

const feedbackDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/agents/$slug/$id/feedback/$index',
  component: FeedbackDetailPage,
  beforeLoad: ({ params }) => chainGuard(params.slug, 'agents'),
});

const networkRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/network/$slug',
  component: NetworkPage,
  beforeLoad: ({ params }) => chainGuard(params.slug, 'agents'),
});

const ownersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/owners/$slug',
  component: OwnersPage,
  validateSearch: pageSearchSchema,
  beforeLoad: ({ params }) => scopeGuard(params.slug, 'owners'),
});

const ownerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/owners/$slug/$address',
  component: OwnerPage,
  validateSearch: pageSearchSchema,
  beforeLoad: ({ params }) => chainGuard(params.slug, 'owners'),
});

const reviewersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/reviewers/$slug',
  component: ReviewersPage,
  validateSearch: pageSearchSchema,
  beforeLoad: ({ params }) => scopeGuard(params.slug, 'reviewers'),
});

const reviewerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/reviewers/$slug/$address',
  component: ReviewerPage,
  validateSearch: pageSearchSchema,
  beforeLoad: ({ params }) => chainGuard(params.slug, 'reviewers'),
});

const feedbacksRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/feedbacks/$slug',
  component: FeedbacksPage,
  validateSearch: pageSearchSchema,
  beforeLoad: ({ params }) => scopeGuard(params.slug, 'feedbacks'),
});

const scanRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/scan/$chainId/$id',
  component: ScanAgentPage,
});

const docsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/docs',
  component: DocsPage,
});

const starredRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/starred',
  component: StarredPage,
});

export const router = createRouter({
  routeTree: rootRoute.addChildren([
    indexRoute,
    agentsRoute,
    agentRoute,
    feedbackDetailRoute,
    networkRoute,
    ownersRoute,
    ownerRoute,
    reviewersRoute,
    reviewerRoute,
    feedbacksRoute,
    scanRoute,
    docsRoute,
    starredRoute,
  ]),
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
