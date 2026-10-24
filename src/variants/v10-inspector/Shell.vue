<script setup lang="ts">
import { CHAINS, DEFAULT_CHAIN } from '../../chains'
import { sourceText, useChainSwitch, useRouteChain } from '../shared/use'

const { route, slug, chain, resolved } = useRouteChain()
const switchTo = useChainSwitch()
// agents + agent and network + reviewer are one view each with a selection.
const GROUP: Record<string, string> = { agents: 'agents', agent: 'agents', network: 'network', reviewer: 'network' }
</script>

<template>
  <div class="i-app">
    <aside class="i-side">
      <RouterLink class="brand" :to="{ name: 'agents', params: { slug: (chain ?? DEFAULT_CHAIN).slug } }">8004rep · inspector</RouterLink>
      <h4>Views</h4>
      <RouterLink :to="{ name: 'agents', params: { slug: (chain ?? DEFAULT_CHAIN).slug } }" :class="{ on: route.name === 'agents' || route.name === 'agent' }">Agents</RouterLink>
      <RouterLink :to="{ name: 'network', params: { slug: (chain ?? DEFAULT_CHAIN).slug } }" :class="{ on: route.name === 'network' || route.name === 'reviewer' }">Network</RouterLink>
      <h4>Networks</h4>
      <button v-for="c in CHAINS" :key="c.slug" :class="{ on: c.slug === chain?.slug }" @click="switchTo(c.slug)"><span>{{ c.name }}</span><span v-if="c.testnet" class="soft">test</span></button>
      <h4 v-if="chain">Source</h4>
      <p v-if="chain" class="soft" style="padding: 0 10px; margin: 0" :title="sourceText(resolved)?.detail">{{ sourceText(resolved)?.label ?? '…' }}</p>
      <h4>Keys</h4>
      <p class="i-kbd" style="padding: 0 10px; margin: 0"><kbd>↑</kbd> <kbd>↓</kbd> move in a list<br /><kbd>Esc</kbd> close the drawer</p>
    </aside>
    <template v-if="slug && !chain">
      <div class="i-empty"><div>Unknown network “{{ slug }}”. Pick one on the left.</div></div>
    </template>
    <!-- Keyed by view, not path: switching the selection keeps the list and its scroll. -->
    <RouterView v-else :key="`${GROUP[String(route.name)] ?? String(route.name)}:${slug}`" />
  </div>
</template>
