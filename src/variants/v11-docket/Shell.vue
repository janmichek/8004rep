<script setup lang="ts">
import { CHAINS, DEFAULT_CHAIN } from '../../chains'
import { sourceText, useChainSwitch, useRouteChain } from '../shared/use'

const { route, slug, chain, resolved } = useRouteChain()
const switchTo = useChainSwitch()
const group = (name: unknown) => (name === 'agent' ? 'agents' : name === 'reviewer' ? 'network' : name)
</script>

<template>
  <div class="d-page">
    <header class="d-masthead">
      <div class="d-seal">§</div>
      <div class="d-title">
        <p>In the matter of the ERC-8004 reputation registry</p>
        <RouterLink :to="{ name: 'agents', params: { slug: (chain ?? DEFAULT_CHAIN).slug } }">THE 8004 DOCKET</RouterLink>
      </div>
      <nav class="d-nav">
        <RouterLink :to="{ name: 'agents', params: { slug: (chain ?? DEFAULT_CHAIN).slug } }" :class="{ on: group(route.name) === 'agents' }">Cause list</RouterLink>
        <RouterLink :to="{ name: 'network', params: { slug: (chain ?? DEFAULT_CHAIN).slug } }" :class="{ on: group(route.name) === 'network' }">Docket</RouterLink>
      </nav>
    </header>
    <div class="d-jurisdictions">
      <span>Jurisdiction</span>
      <button v-for="c in CHAINS" :key="c.slug" :class="{ on: c.slug === chain?.slug }" @click="switchTo(c.slug)">{{ c.name }}</button>
      <span v-if="chain" class="d-source" :title="sourceText(resolved)?.detail">record: {{ sourceText(resolved)?.label ?? '…' }}</span>
    </div>
    <main class="d-main">
      <template v-if="slug && !chain">
        <p class="d-kicker">Dismissed</p>
        <h1 class="d-h1">No such jurisdiction: “{{ slug }}”</h1>
        <p class="d-lede">The court reads <template v-for="c in CHAINS" :key="c.slug"><RouterLink :to="{ name: 'agents', params: { slug: c.slug } }">{{ c.name }}</RouterLink><template v-if="c !== CHAINS.at(-1)">, </template></template>.</p>
      </template>
      <RouterView v-else :key="`${group(route.name)}:${slug}`" />
    </main>
    <footer class="d-foot">Read-only record · no wallet · every figure is re-derivable from the testimony below</footer>
  </div>
</template>
