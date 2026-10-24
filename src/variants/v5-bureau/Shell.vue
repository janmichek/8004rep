<script setup lang="ts">
import { CHAINS, DEFAULT_CHAIN } from '../../chains'
import { sourceText, useChainSwitch, useRouteChain } from '../shared/use'

const { route, slug, chain, resolved } = useRouteChain()
const switchTo = useChainSwitch()
const reportRef = `RPT-${Date.now().toString(36).toUpperCase()}`
</script>

<template>
  <div class="u-desk">
    <article class="u-sheet">
      <header class="u-letterhead">
        <div>
          <h1>8004 Reputation Bureau</h1>
          <p>Agent credit file · consumer copy · read-only</p>
        </div>
        <div style="text-align: right">
          <p>Ref {{ reportRef }}</p>
          <p>Issued {{ new Date().toISOString().slice(0, 10) }}</p>
          <p v-if="chain" :title="sourceText(resolved)?.detail">Source: {{ sourceText(resolved)?.label ?? '…' }}</p>
        </div>
      </header>
      <nav class="u-tabs">
        <RouterLink :to="{ name: 'agents', params: { slug: (chain ?? DEFAULT_CHAIN).slug } }" :class="{ on: route.name === 'agents' }">Subject index</RouterLink>
        <RouterLink :to="{ name: 'network', params: { slug: (chain ?? DEFAULT_CHAIN).slug } }" :class="{ on: route.name === 'network' }">Bulletin</RouterLink>
        <span style="flex: 1" />
        <button v-for="c in CHAINS" :key="c.slug" :class="{ on: c.slug === chain?.slug }" @click="switchTo(c.slug)">{{ c.shortName }}</button>
      </nav>
      <template v-if="slug && !chain">
        <p class="u-notice">Jurisdiction “{{ slug }}” is not covered by this bureau.</p>
        <p><RouterLink v-for="c in CHAINS" :key="c.slug" :to="{ name: 'agents', params: { slug: c.slug } }" class="u-mark">{{ c.name }}</RouterLink></p>
      </template>
      <RouterView v-else :key="route.path" />
      <p class="u-foot">This file is compiled from public ERC-8004 registry records and subgraphs. No wallet, no backend. Every entry can be verified on the chain it cites.</p>
    </article>
  </div>
</template>
