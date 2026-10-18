import { createRouter, createWebHashHistory } from 'vue-router'
import { DEFAULT_CHAIN } from './chains'
import AgentPage from './pages/AgentPage.vue'
import AgentsPage from './pages/AgentsPage.vue'
import NetworkPage from './pages/NetworkPage.vue'
import OwnerPage from './pages/OwnerPage.vue'
import ReviewerPage from './pages/ReviewerPage.vue'

// Paths mirror 8004scan (`/agents/<network>/<tokenId>`); hash history keeps
// the build deployable to any static host without rewrite rules.
export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: `/agents/${DEFAULT_CHAIN.slug}` },
    { path: '/agents/:slug', name: 'agents', component: AgentsPage, props: true },
    { path: '/agents/:slug/:id', name: 'agent', component: AgentPage, props: true },
    { path: '/network/:slug', name: 'network', component: NetworkPage, props: true },
    { path: '/owners/:slug/:address', name: 'owner', component: OwnerPage, props: true },
    { path: '/reviewers/:slug/:address', name: 'reviewer', component: ReviewerPage, props: true },
    { path: '/:rest(.*)*', redirect: '/' },
  ],
  // Switching tabs only changes the query: keep the scroll position then.
  scrollBehavior: (to, from) => (to.path === from.path ? false : { top: 0 }),
})
