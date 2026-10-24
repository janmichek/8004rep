<script setup lang="ts">
import { CHAINS, DEFAULT_CHAIN } from '../../chains'
import { sourceText, useChainSwitch, useRouteChain } from '../shared/use'

const { route, slug, chain, resolved } = useRouteChain()
const switchTo = useChainSwitch()
const group = (name: unknown) => (name === 'agent' ? 'agents' : name === 'reviewer' ? 'network' : name)
</script>

<template>
  <div class="f-page">
    <header class="f-head">
      <div class="f-brand">
        <span class="f-sun">☀</span>
        <div>
          <p>8004 Meteorological Service</p>
          <RouterLink :to="{ name: 'agents', params: { slug: (chain ?? DEFAULT_CHAIN).slug } }">Reputation weather</RouterLink>
        </div>
      </div>
      <nav class="f-nav">
        <RouterLink :to="{ name: 'agents', params: { slug: (chain ?? DEFAULT_CHAIN).slug } }" :class="{ on: group(route.name) === 'agents' }">Local forecast</RouterLink>
        <RouterLink :to="{ name: 'network', params: { slug: (chain ?? DEFAULT_CHAIN).slug } }" :class="{ on: group(route.name) === 'network' }">Regional bulletin</RouterLink>
      </nav>
      <div class="f-regions">
        <span>Region</span>
        <button v-for="c in CHAINS" :key="c.slug" :class="{ on: c.slug === chain?.slug }" @click="switchTo(c.slug)">{{ c.shortName }}</button>
      </div>
    </header>
    <p v-if="chain" class="f-station" :title="sourceText(resolved)?.detail">Reporting station: {{ sourceText(resolved)?.label ?? '…' }} · {{ chain.name }}</p>
    <main class="f-main">
      <template v-if="slug && !chain">
        <p class="f-kicker">No station</p>
        <h1 class="f-h1">No observations for “{{ slug }}”.</h1>
        <p class="f-prose">Choose a region: <template v-for="c in CHAINS" :key="c.slug"><RouterLink :to="{ name: 'agents', params: { slug: c.slug } }">{{ c.name }}</RouterLink><template v-if="c !== CHAINS.at(-1)"> · </template></template></p>
      </template>
      <RouterView v-else :key="`${group(route.name)}:${slug}`" />
    </main>
    <footer class="f-foot">Observations, not promises. The forecast is derived from feedback already on chain.</footer>
  </div>
</template>
