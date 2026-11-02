<script setup lang="ts">
import { TooltipProvider } from 'reka-ui'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ALL_NETWORKS, CHAINS, DEFAULT_CHAIN, findChainBySlug } from './chains'
import ChainName from './components/ChainName.vue'
import SourceBadge from './components/SourceBadge.vue'
import SelectMenu, { type SelectOption } from './components/ui/SelectMenu.vue'
import { sourceFor } from './data'
import { networkEnv, setNetworkEnv, type NetworkEnv } from './env'
import { starCount } from './stars'
import { useAsync } from './useAsync'

const ENV_OPTIONS: SelectOption[] = [
  { value: 'mainnet', label: 'Mainnet' },
  { value: 'testnet', label: 'Testnet' },
]

const route = useRoute()
const router = useRouter()
const slug = computed(() => (typeof route.params.slug === 'string' ? route.params.slug : undefined))
const chain = computed(() => (slug.value && slug.value !== ALL_NETWORKS ? findChainBySlug(slug.value) : undefined))
// The agent list now spans every network, so a per-chain source badge would mislead there.
const showSource = computed(() => route.name !== 'agents')

// On a chain-specific page the chain decides the environment; the agent list follows the switch.
const env = computed<NetworkEnv>(() =>
  route.name !== 'agents' && chain.value ? (chain.value.testnet ? 'testnet' : 'mainnet') : networkEnv.value,
)
const envFallback = computed(() => CHAINS.find((item) => item.testnet === (networkEnv.value === 'testnet')) ?? DEFAULT_CHAIN)
const activeChain = computed(() =>
  chain.value && chain.value.testnet === (networkEnv.value === 'testnet') ? chain.value : envFallback.value,
)
// Owners, reviewers and feedbacks keep the all-networks view when you are on it.
const listSlug = computed(() => (slug.value === ALL_NETWORKS ? ALL_NETWORKS : activeChain.value.slug))

function switchEnv(value: string | undefined): void {
  if (value !== 'mainnet' && value !== 'testnet') return
  if (value === env.value) return
  setNetworkEnv(value)
  if (route.name === 'agents' || slug.value === ALL_NETWORKS) return
  const testnet = value === 'testnet'
  if (chain.value?.testnet === testnet) return
  const target = CHAINS.find((item) => item.testnet === testnet) ?? DEFAULT_CHAIN
  // A per-network page swaps its chain and stays put. A record of one chain
  // (agent, owner, reviewer, feedback) has no counterpart on the other side,
  // so it falls back to the agent list.
  const name = route.name
  const stays = name === 'network' || name === 'owners' || name === 'reviewers' || name === 'feedbacks'
  void router.push({ name: stays ? name : 'agents', params: { slug: target.slug } })
}

const { data: resolved } = useAsync(async () => (chain.value ? sourceFor(chain.value) : undefined), chain)
</script>

<template>
  <TooltipProvider :delay-duration="280" :skip-delay-duration="120">
    <header class="topbar">
      <RouterLink class="brand" :to="{ name: 'agents', params: { slug: activeChain.slug } }">
        8004<span>rep</span>
      </RouterLink>
      <nav class="nav">
        <RouterLink :to="{ name: 'agents', params: { slug: activeChain.slug } }">Agents</RouterLink>
        <RouterLink :to="{ name: 'owners', params: { slug: listSlug } }">Owners</RouterLink>
        <RouterLink :to="{ name: 'reviewers', params: { slug: listSlug } }">Reviewers</RouterLink>
        <RouterLink :to="{ name: 'feedbacks', params: { slug: listSlug } }">Feedbacks</RouterLink>
        <RouterLink :to="{ name: 'network', params: { slug: activeChain.slug } }">Network health</RouterLink>
        <RouterLink :to="{ name: 'docs' }">Docs</RouterLink>
      </nav>
      <div class="topbar-right">
        <SelectMenu
          class="env-switch"
          compact
          :model-value="env"
          :options="ENV_OPTIONS"
          label="Network environment"
          @update:model-value="switchEnv"
        />
        <SourceBadge v-if="chain && showSource" :resolved="resolved" />
        <RouterLink
          class="star-link"
          :to="{ name: 'starred' }"
          :aria-label="`Starred (${starCount})`"
          title="Starred agents, owners and reviewers"
        >
          <span aria-hidden="true">★</span>
          <span v-if="starCount" class="star-count">{{ starCount }}</span>
        </RouterLink>
      </div>
    </header>

    <main>
      <section v-if="slug && !chain && slug !== ALL_NETWORKS" class="state">
        <h1>Unknown network “{{ slug }}”</h1>
        <p>Supported networks:</p>
        <ul class="plain">
          <li v-for="c in CHAINS" :key="c.chainId">
            <RouterLink :to="{ name: 'agents', params: { slug: c.slug } }">
              <ChainName :chain-id="c.chainId" :name="c.name" />
            </RouterLink>
          </li>
        </ul>
      </section>
      <div v-else :key="route.path" class="page"><RouterView /></div>
    </main>

    <footer>
      Read-only: no wallet, no backend. Data comes straight from the ERC-8004 registries and public subgraphs.
      <RouterLink :to="{ name: 'docs' }">How the numbers work</RouterLink>
    </footer>
  </TooltipProvider>
</template>
