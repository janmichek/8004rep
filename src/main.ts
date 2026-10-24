import { createApp, h, type Component } from 'vue'
import { makeRouter } from './router'
import { currentVariant, type VariantModule } from './variants/registry'
import VariantSwitcher from './variants/VariantSwitcher.vue'

async function classic(): Promise<VariantModule> {
  const [{ default: Shell }, agents, agent, network, owner, reviewer, feedback, scanAgent] = await Promise.all([
    import('./App.vue'),
    import('./pages/AgentsPage.vue'),
    import('./pages/AgentPage.vue'),
    import('./pages/NetworkPage.vue'),
    import('./pages/OwnerPage.vue'),
    import('./pages/ReviewerPage.vue'),
    import('./pages/FeedbackDetailPage.vue'),
    import('./pages/ScanAgentPage.vue'),
    import('./style.css'),
  ])
  return {
    Shell,
    pages: {
      agents: agents.default,
      agent: agent.default,
      network: network.default,
      owner: owner.default,
      reviewer: reviewer.default,
      feedback: feedback.default,
      scanAgent: scanAgent.default,
    },
  }
}

async function boot(): Promise<void> {
  const variant = currentVariant()
  const { Shell, pages } = await (variant.load ?? classic)()
  document.documentElement.dataset.variant = String(variant.id)
  const root: Component = { render: () => [h(Shell), h(VariantSwitcher, { current: variant.id })] }
  createApp(root).use(makeRouter(pages)).mount('#app')
}

void boot()
