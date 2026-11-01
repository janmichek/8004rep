import { createRouter, createWebHashHistory } from 'vue-router'
import { defaultChainFor } from './chains'
import { networkEnv } from './env'
import AboutPage from './pages/AboutPage.vue'
import FeedbacksPage from './pages/FeedbacksPage.vue'
import OwnersPage from './pages/OwnersPage.vue'
import ReviewersPage from './pages/ReviewersPage.vue'
import StarredPage from './pages/StarredPage.vue'
import type { PageSet } from './variants/registry'

// Paths mirror 8004scan (`/agents/<network>/<tokenId>`); hash history keeps
// the build deployable to any static host without rewrite rules. Every
// design routes the same paths to its own pages.
export function makeRouter(pages: PageSet) {
  return createRouter({
    history: createWebHashHistory(),
    routes: [
      // Land on the environment the header shows (Mainnet unless the user chose Testnet).
      { path: '/', redirect: () => ({ name: 'agents', params: { slug: defaultChainFor(networkEnv.value === 'testnet').slug } }) },
      { path: '/agents/:slug', name: 'agents', component: pages.agents, props: true },
      // Only the classic design gives a feedback row its own view.
      ...(pages.feedback
        ? [{ path: '/agents/:slug/:id/feedback/:index', name: 'feedback', component: pages.feedback, props: true }]
        : []),
      { path: '/agents/:slug/:id', name: 'agent', component: pages.agent, props: true },
      ...(pages.scanAgent
        ? [{ path: '/scan/:chainId/:id', name: 'scan-agent', component: pages.scanAgent, props: true }]
        : []),
      { path: '/network/:slug', name: 'network', component: pages.network, props: true },
      ...(pages.owner ? [{ path: '/owners/:slug/:address', name: 'owner', component: pages.owner, props: true }] : []),
      ...(pages.reviewer ? [{ path: '/reviewers/:slug/:address', name: 'reviewer', component: pages.reviewer, props: true }] : []),
      // Per-network lists of owners, reviewers and feedback (classic header links).
      { path: '/owners/:slug', name: 'owners', component: OwnersPage, props: true },
      { path: '/reviewers/:slug', name: 'reviewers', component: ReviewersPage, props: true },
      { path: '/feedbacks/:slug', name: 'feedbacks', component: FeedbacksPage, props: true },
      // Shared across every design: the metric guide has its own styles and anchors.
      { path: '/about', name: 'about', component: AboutPage },
      { path: '/starred', name: 'starred', component: StarredPage },
      { path: '/:rest(.*)*', redirect: '/' },
    ],
    // Anchors jump straight to the section (no smooth animation); AboutPage then
    // flashes it. Tab switches (query only) keep the scroll position.
    scrollBehavior: (to, from) => {
      if (to.hash) return { el: to.hash, top: 84, behavior: 'auto' }
      return to.path === from.path ? false : { top: 0 }
    },
  })
}
