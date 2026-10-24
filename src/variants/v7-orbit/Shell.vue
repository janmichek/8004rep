<script setup lang="ts">
import { CHAINS, DEFAULT_CHAIN } from '../../chains'
import { sourceText, useChainSwitch, useRouteChain } from '../shared/use'

const { route, slug, chain, resolved } = useRouteChain()
const switchTo = useChainSwitch()
</script>

<template>
  <header class="o-top">
    <RouterLink class="o-logo" :to="{ name: 'network', params: { slug: (chain ?? DEFAULT_CHAIN).slug } }">8004<b>·</b>ORBIT</RouterLink>
    <nav class="o-nav">
      <RouterLink :to="{ name: 'network', params: { slug: (chain ?? DEFAULT_CHAIN).slug } }" :class="{ on: route.name === 'network' }">Constellation</RouterLink>
      <RouterLink :to="{ name: 'agents', params: { slug: (chain ?? DEFAULT_CHAIN).slug } }" :class="{ on: route.name === 'agents' }">Star field</RouterLink>
    </nav>
    <span style="flex: 1" />
    <span v-if="chain" class="o-chip" :class="sourceText(resolved)?.ok ? 'ok' : 'agent'" :title="sourceText(resolved)?.detail">{{ sourceText(resolved)?.label ?? '…' }}</span>
    <div class="o-chains"><button v-for="c in CHAINS" :key="c.slug" :class="{ on: c.slug === chain?.slug }" @click="switchTo(c.slug)">{{ c.shortName }}</button></div>
  </header>
  <main class="o-wrap">
    <template v-if="slug && !chain">
      <h1 class="o-title">No sky called “{{ slug }}”</h1>
      <p><RouterLink v-for="c in CHAINS" :key="c.slug" :to="{ name: 'agents', params: { slug: c.slug } }" class="o-chip">{{ c.name }}</RouterLink></p>
    </template>
    <RouterView v-else :key="route.path" />
  </main>
</template>
