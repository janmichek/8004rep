import { createRouter, createWebHashHistory } from 'vue-router'
import { DEFAULT_CHAIN } from './chains'
import AboutPage from './pages/AboutPage.vue'
import type { PageSet } from './variants/registry'

// Paths mirror 8004scan (`/agents/<network>/<tokenId>`); hash history keeps
// the build deployable to any static host without rewrite rules. Every
// design routes the same paths to its own pages.
export function makeRouter(pages: PageSet) {
  return createRouter({
    history: createWebHashHistory(),
    routes: [
      { path: '/', redirect: `/agents/${DEFAULT_CHAIN.slug}` },
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
      { path: '/owners/:slug/:address', name: 'owner', component: pages.owner, props: true },
      { path: '/reviewers/:slug/:address', name: 'reviewer', component: pages.reviewer, props: true },
      // Shared across every design: the metric guide has its own styles and anchors.
      { path: '/about', name: 'about', component: AboutPage },
      { path: '/:rest(.*)*', redirect: '/' },
    ],
    // Switching tabs only changes the query: keep the scroll position then.
    scrollBehavior: (to, from) => {
      if (to.hash) return { el: to.hash, top: 84, behavior: 'smooth' }
      return to.path === from.path ? false : { top: 0 }
    },
  })
}
