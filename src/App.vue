<script setup lang="ts">
import { TooltipProvider } from 'reka-ui'
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { CHAINS, DEFAULT_CHAIN, findChainBySlug } from './chains'
import ChainSelect from './components/ChainSelect.vue'
import SourceBadge from './components/SourceBadge.vue'
import { sourceFor } from './data'
import { useAsync } from './useAsync'

const route = useRoute()
const slug = computed(() => (typeof route.params.slug === 'string' ? route.params.slug : undefined))
const chain = computed(() => (slug.value ? findChainBySlug(slug.value) : undefined))

const { data: resolved } = useAsync(async () => (chain.value ? sourceFor(chain.value) : undefined), chain)
</script>

<template>
  <TooltipProvider :delay-duration="280" :skip-delay-duration="120">
    <header class="topbar">
      <RouterLink class="brand" :to="{ name: 'agents', params: { slug: (chain ?? DEFAULT_CHAIN).slug } }">
        8004<span>rep</span>
      </RouterLink>
      <nav class="nav">
        <RouterLink :to="{ name: 'agents', params: { slug: (chain ?? DEFAULT_CHAIN).slug } }">Agents</RouterLink>
        <RouterLink :to="{ name: 'network', params: { slug: (chain ?? DEFAULT_CHAIN).slug } }">Network health</RouterLink>
      </nav>
      <div class="topbar-right">
        <SourceBadge v-if="chain" :resolved="resolved" />
        <ChainSelect :current="chain" />
      </div>
    </header>

    <main>
      <section v-if="slug && !chain" class="state">
        <h1>Unknown network “{{ slug }}”</h1>
        <p>Supported networks:</p>
        <ul class="plain">
          <li v-for="c in CHAINS" :key="c.chainId">
            <RouterLink :to="{ name: 'agents', params: { slug: c.slug } }">{{ c.name }}</RouterLink>
          </li>
        </ul>
      </section>
      <RouterView v-else />
    </main>

    <footer>
      Read-only: no wallet, no backend. Data comes straight from the ERC-8004 registries and public subgraphs.
    </footer>
  </TooltipProvider>
</template>
