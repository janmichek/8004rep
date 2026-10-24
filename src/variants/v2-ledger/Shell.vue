<script setup lang="ts">
import { CHAINS, DEFAULT_CHAIN } from '../../chains'
import { sourceText, useChainSwitch, useRouteChain } from '../shared/use'

const { route, slug, chain, resolved } = useRouteChain()
const switchTo = useChainSwitch()
const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
</script>

<template>
  <div class="l-page">
    <header class="l-mast">
      <h1><RouterLink :to="{ name: 'network', params: { slug: (chain ?? DEFAULT_CHAIN).slug } }">The 8004 Ledger</RouterLink></h1>
      <p class="muted" style="margin: 4px 0 0; font-style: italic">All the reputation that's fit to verify</p>
    </header>
    <div class="l-dateline">
      <span>{{ today }}</span>
      <nav>
        <RouterLink :to="{ name: 'network', params: { slug: (chain ?? DEFAULT_CHAIN).slug } }" :class="{ on: route.name === 'network' }">Front page</RouterLink>
        <RouterLink :to="{ name: 'agents', params: { slug: (chain ?? DEFAULT_CHAIN).slug } }" :class="{ on: route.name === 'agents' }">The Register</RouterLink>
      </nav>
      <nav aria-label="Edition">
        <a v-for="c in CHAINS" :key="c.slug" href="#" :class="{ on: c.slug === chain?.slug }" @click.prevent="switchTo(c.slug)">{{ c.shortName }}</a>
      </nav>
      <span v-if="chain" :title="sourceText(resolved)?.detail">Wire: {{ sourceText(resolved)?.label ?? '…' }}</span>
    </div>
    <main>
      <template v-if="slug && !chain">
        <p class="l-kicker">Correction</p>
        <h2 class="l-head">No edition is printed for “{{ slug }}”</h2>
        <p>Editions in circulation: <template v-for="c in CHAINS" :key="c.slug"><RouterLink :to="{ name: 'agents', params: { slug: c.slug } }">{{ c.name }}</RouterLink>; </template></p>
      </template>
      <RouterView v-else :key="route.path" />
    </main>
    <p class="l-corr muted">Printed read-only. No wallet, no backend: every figure is taken from the ERC-8004 registries and public subgraphs, and can be checked against them.</p>
  </div>
</template>
