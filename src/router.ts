import { createRouter, createWebHashHistory } from 'vue-router'
import { ALL_NETWORKS } from './chains'
import { requireChain, requireScope } from './routeGuards'
import type { PageSet } from './variants/registry'

// Only the classic design's own pages are lazy here (the variants load theirs
// through `main.ts`): eager imports of these would put every page in the entry
// chunk for visitors who never open them.
const DocsPage = () => import('./pages/DocsPage.vue')
const FeedbacksPage = () => import('./pages/FeedbacksPage.vue')
const OwnersPage = () => import('./pages/OwnersPage.vue')
const ReviewersPage = () => import('./pages/ReviewersPage.vue')
const StarredPage = () => import('./pages/StarredPage.vue')

// Paths mirror 8004scan (`/agents/<network>/<tokenId>`); hash history keeps
// the build deployable to any static host without rewrite rules. Every
// design routes the same paths to its own pages.
export function makeRouter(pages: PageSet) {
  return createRouter({
    history: createWebHashHistory(),
    routes: [
      // Land on all networks of the environment the header shows (Mainnet unless the user chose Testnet).
      { path: '/', redirect: () => ({ name: 'agents', params: { slug: ALL_NETWORKS } }) },
      { path: '/agents/:slug', name: 'agents', component: pages.agents, props: true, beforeEnter: requireScope },
      // Only the classic design gives a feedback row its own view.
      ...(pages.feedback
        ? [
            {
              path: '/agents/:slug/:id/feedback/:index',
              name: 'feedback',
              component: pages.feedback,
              props: true,
              beforeEnter: requireChain('agents'),
            },
          ]
        : []),
      { path: '/agents/:slug/:id', name: 'agent', component: pages.agent, props: true, beforeEnter: requireChain('agents') },
      ...(pages.scanAgent
        ? [{ path: '/scan/:chainId/:id', name: 'scan-agent', component: pages.scanAgent, props: true }]
        : []),
      { path: '/network/:slug', name: 'network', component: pages.network, props: true, beforeEnter: requireChain('agents') },
      ...(pages.owner
        ? [
            {
              path: '/owners/:slug/:address',
              name: 'owner',
              component: pages.owner,
              props: true,
              beforeEnter: requireChain('owners'),
            },
          ]
        : []),
      ...(pages.reviewer
        ? [
            {
              path: '/reviewers/:slug/:address',
              name: 'reviewer',
              component: pages.reviewer,
              props: true,
              beforeEnter: requireChain('reviewers'),
            },
          ]
        : []),
      // Per-network lists of owners, reviewers and feedback (classic header links).
      { path: '/owners/:slug', name: 'owners', component: OwnersPage, props: true, beforeEnter: requireScope },
      { path: '/reviewers/:slug', name: 'reviewers', component: ReviewersPage, props: true, beforeEnter: requireScope },
      { path: '/feedbacks/:slug', name: 'feedbacks', component: FeedbacksPage, props: true, beforeEnter: requireScope },
      // Shared across every design: the metric guide has its own styles and anchors.
      { path: '/docs', name: 'docs', component: DocsPage },
      { path: '/starred', name: 'starred', component: StarredPage },
      { path: '/:rest(.*)*', redirect: '/' },
    ],
    // Anchors jump straight to the section (no smooth animation); DocsPage then
    // flashes it. Tab switches (query only) keep the scroll position.
    scrollBehavior: (to, from) => {
      if (to.hash) return { el: to.hash, top: 84, behavior: 'auto' }
      return to.path === from.path ? false : { top: 0 }
    },
  })
}
