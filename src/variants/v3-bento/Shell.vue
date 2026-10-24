<script setup lang="ts">
import { CHAINS, DEFAULT_CHAIN } from '../../chains'
import { sourceText, useChainSwitch, useRouteChain } from '../shared/use'

const { route, slug, chain, resolved } = useRouteChain()
const switchTo = useChainSwitch()
</script>

<template>
  <header class="b-top">
    <RouterLink class="b-logo" :to="{ name: 'agents', params: { slug: (chain ?? DEFAULT_CHAIN).slug } }">8004<i>rep</i></RouterLink>
    <nav class="b-seg">
      <RouterLink :to="{ name: 'agents', params: { slug: (chain ?? DEFAULT_CHAIN).slug } }" :class="{ on: route.name === 'agents' }">Agents</RouterLink>
      <RouterLink :to="{ name: 'network', params: { slug: (chain ?? DEFAULT_CHAIN).slug } }" :class="{ on: route.name === 'network' }">Network</RouterLink>
    </nav>
    <span style="flex: 1" />
    <span v-if="chain" class="b-pill" :class="sourceText(resolved)?.ok ? 'good' : 'warn'" :title="sourceText(resolved)?.detail">{{ sourceText(resolved)?.label ?? '…' }}</span>
    <nav class="b-seg" aria-label="Network" style="overflow-x: auto; max-width: 100%">
      <button v-for="c in CHAINS" :key="c.slug" :class="{ on: c.slug === chain?.slug }" @click="switchTo(c.slug)">{{ c.shortName }}</button>
    </nav>
  </header>
  <main class="b-wrap">
    <div v-if="slug && !chain" class="b-grid">
      <section class="b-card s12">
        <h3>Unknown network</h3>
        <p class="b-mid">“{{ slug }}” isn't one we read.</p>
        <p><RouterLink v-for="c in CHAINS" :key="c.slug" :to="{ name: 'agents', params: { slug: c.slug } }" class="b-pill">{{ c.name }}</RouterLink></p>
      </section>
    </div>
    <RouterView v-else :key="route.path" />
  </main>
</template>
