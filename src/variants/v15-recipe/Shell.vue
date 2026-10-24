<script setup lang="ts">
import { CHAINS, DEFAULT_CHAIN } from '../../chains'
import { sourceText, useChainSwitch, useRouteChain } from '../shared/use'

const { route, slug, chain, resolved } = useRouteChain()
const switchTo = useChainSwitch()
const group = (name: unknown) => (name === 'agent' ? 'agents' : name === 'reviewer' ? 'network' : name)
</script>

<template>
  <div class="r-page">
    <header class="r-head">
      <div>
        <p class="r-imprint">A field cookbook of ERC-8004 agents</p>
        <RouterLink class="r-title" :to="{ name: 'agents', params: { slug: (chain ?? DEFAULT_CHAIN).slug } }">The 8004 <i>Cookbook</i></RouterLink>
      </div>
      <nav class="r-nav">
        <RouterLink :to="{ name: 'agents', params: { slug: (chain ?? DEFAULT_CHAIN).slug } }" :class="{ on: group(route.name) === 'agents' }">Recipes</RouterLink>
        <RouterLink :to="{ name: 'network', params: { slug: (chain ?? DEFAULT_CHAIN).slug } }" :class="{ on: group(route.name) === 'network' }">Kitchen report</RouterLink>
      </nav>
    </header>
    <div class="r-pantry">
      <span>Pantry</span>
      <button v-for="c in CHAINS" :key="c.slug" :class="{ on: c.slug === chain?.slug }" @click="switchTo(c.slug)">{{ c.name }}</button>
      <span v-if="chain" class="r-src" :title="sourceText(resolved)?.detail">baskets from {{ sourceText(resolved)?.label ?? '…' }}</span>
    </div>
    <main class="r-main">
      <template v-if="slug && !chain">
        <p class="r-kicker">Empty pantry</p>
        <h1 class="r-h1">We have no recipes from “{{ slug }}”.</h1>
        <p class="r-prose">Our baskets come from <template v-for="c in CHAINS" :key="c.slug"><RouterLink :to="{ name: 'agents', params: { slug: c.slug } }">{{ c.name }}</RouterLink><template v-if="c !== CHAINS.at(-1)">, </template></template>.</p>
      </template>
      <RouterView v-else :key="`${group(route.name)}:${slug}`" />
    </main>
    <footer class="r-foot">Every recipe is read off the chain. No tasting notes were invented in the kitchen.</footer>
  </div>
</template>
