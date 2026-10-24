<script setup lang="ts">
import { CHAINS, DEFAULT_CHAIN } from '../../chains'
import { sourceText, useChainSwitch, useRouteChain } from '../shared/use'

const { route, slug, chain, resolved } = useRouteChain()
const switchTo = useChainSwitch()
</script>

<template>
  <header class="g-top">
    <RouterLink class="g-logo" :to="{ name: 'agents', params: { slug: (chain ?? DEFAULT_CHAIN).slug } }">8004 <b>League</b></RouterLink>
    <nav class="g-nav">
      <RouterLink :to="{ name: 'agents', params: { slug: (chain ?? DEFAULT_CHAIN).slug } }" :class="{ on: route.name === 'agents' }">Standings</RouterLink>
      <RouterLink :to="{ name: 'network', params: { slug: (chain ?? DEFAULT_CHAIN).slug } }" :class="{ on: route.name === 'network' }">Season</RouterLink>
    </nav>
    <span style="flex: 1" />
    <span v-if="chain" class="g-chip" :class="sourceText(resolved)?.ok ? 'green' : 'yellow'" :title="sourceText(resolved)?.detail">{{ sourceText(resolved)?.label ?? '…' }}</span>
    <nav class="g-leagues" aria-label="League">
      <button v-for="c in CHAINS" :key="c.slug" :class="{ on: c.slug === chain?.slug }" @click="switchTo(c.slug)">{{ c.shortName }}</button>
    </nav>
  </header>
  <main class="g-wrap">
    <template v-if="slug && !chain">
      <h1 class="g-title"><small>Not found</small>No league called “{{ slug }}”</h1>
      <p><RouterLink v-for="c in CHAINS" :key="c.slug" :to="{ name: 'agents', params: { slug: c.slug } }" class="g-chip">{{ c.name }}</RouterLink></p>
    </template>
    <RouterView v-else :key="route.path" />
  </main>
</template>
