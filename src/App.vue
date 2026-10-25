<script setup lang="ts">
import { TooltipProvider } from 'reka-ui'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CHAINS, DEFAULT_CHAIN, findChainBySlug } from './chains'
import ChainName from './components/ChainName.vue'
import SourceBadge from './components/SourceBadge.vue'
import Segmented, { type Segment } from './components/ui/Segmented.vue'
import { sourceFor } from './data'
import { networkEnv, setNetworkEnv, type NetworkEnv } from './env'
import { useAsync } from './useAsync'

const ENV_SEGMENTS: Segment[] = [
  { id: 'mainnet', label: 'Mainnet' },
  { id: 'testnet', label: 'Testnet' },
]

const route = useRoute()
const router = useRouter()
const slug = computed(() => (typeof route.params.slug === 'string' ? route.params.slug : undefined))
const chain = computed(() => (slug.value ? findChainBySlug(slug.value) : undefined))
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

function switchEnv(value: string): void {
  if (value !== 'mainnet' && value !== 'testnet') return
  if (value === env.value) return
  setNetworkEnv(value)
  if (route.name === 'agents') return
  const testnet = value === 'testnet'
  const target = CHAINS.find((item) => item.testnet === testnet) ?? DEFAULT_CHAIN
  if (route.name === 'network') {
    if (chain.value?.testnet !== testnet) void router.push({ name: 'network', params: { slug: target.slug } })
    return
  }
  if (chain.value?.testnet !== testnet) void router.push({ name: 'agents', params: { slug: target.slug } })
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
        <RouterLink :to="{ name: 'network', params: { slug: activeChain.slug } }">Network health</RouterLink>
        <RouterLink :to="{ name: 'about' }">About</RouterLink>
      </nav>
      <div class="topbar-right">
        <Segmented
          class="env-switch"
          :model-value="env"
          :segments="ENV_SEGMENTS"
          label="Network environment"
          @update:model-value="switchEnv"
        />
        <SourceBadge v-if="chain && showSource" :resolved="resolved" />
      </div>
    </header>

    <main>
      <section v-if="slug && !chain" class="state">
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
      <RouterLink :to="{ name: 'about' }">How the numbers work</RouterLink>
    </footer>
  </TooltipProvider>
</template>
