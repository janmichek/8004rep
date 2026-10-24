<script setup lang="ts">
import { CHAINS, DEFAULT_CHAIN } from '../../chains'
import { sourceText, useChainSwitch, useRouteChain } from '../shared/use'

const { route, slug, chain, resolved } = useRouteChain()
const switchTo = useChainSwitch()
const group = (name: unknown) => (name === 'agent' ? 'agents' : name === 'reviewer' ? 'network' : name)
</script>

<template>
  <div class="h-page">
    <header class="h-head">
      <div class="h-brand">
        <svg viewBox="0 0 40 40" aria-hidden="true" class="h-leaf">
          <path d="M20 35 C20 22 20 12 20 5 M20 18 C14 16 9 11 8 5 C15 5 19 10 20 18 M20 24 C26 22 31 17 32 11 C25 11 21 16 20 24" fill="none" stroke="currentColor" stroke-width="1.4" />
        </svg>
        <div>
          <p>Herbarium</p>
          <RouterLink :to="{ name: 'agents', params: { slug: (chain ?? DEFAULT_CHAIN).slug } }">8004 · agentia reputata</RouterLink>
        </div>
      </div>
      <nav class="h-nav">
        <RouterLink :to="{ name: 'agents', params: { slug: (chain ?? DEFAULT_CHAIN).slug } }" :class="{ on: group(route.name) === 'agents' }">Field guide</RouterLink>
        <RouterLink :to="{ name: 'network', params: { slug: (chain ?? DEFAULT_CHAIN).slug } }" :class="{ on: group(route.name) === 'network' }">Survey report</RouterLink>
      </nav>
    </header>
    <div class="h-region">
      <span>Region</span>
      <button v-for="c in CHAINS" :key="c.slug" :class="{ on: c.slug === chain?.slug }" @click="switchTo(c.slug)">{{ c.name }}</button>
      <span v-if="chain" class="h-src" :title="sourceText(resolved)?.detail">collected via {{ sourceText(resolved)?.label ?? '…' }}</span>
    </div>
    <main class="h-main">
      <template v-if="slug && !chain">
        <p class="h-kicker">Uncharted region</p>
        <h1 class="h-h1">No survey has been made of “{{ slug }}”.</h1>
        <p class="h-prose">The herbarium holds <template v-for="c in CHAINS" :key="c.slug"><RouterLink :to="{ name: 'agents', params: { slug: c.slug } }">{{ c.name }}</RouterLink><template v-if="c !== CHAINS.at(-1)">, </template></template>.</p>
      </template>
      <RouterView v-else :key="`${group(route.name)}:${slug}`" />
    </main>
    <footer class="h-foot">Collected in the field · determinations are provisional · no specimen was harmed</footer>
  </div>
</template>
