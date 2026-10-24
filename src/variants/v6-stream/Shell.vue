<script setup lang="ts">
import { CHAINS, DEFAULT_CHAIN } from '../../chains'
import { sourceText, useChainSwitch, useRouteChain } from '../shared/use'

const { route, slug, chain, resolved } = useRouteChain()
const switchTo = useChainSwitch()
</script>

<template>
  <div class="s-app">
    <nav class="s-left">
      <RouterLink class="logo" :to="{ name: 'network', params: { slug: (chain ?? DEFAULT_CHAIN).slug } }">8⁰⁰⁴</RouterLink>
      <RouterLink class="nav" :class="{ on: route.name === 'network' }" :to="{ name: 'network', params: { slug: (chain ?? DEFAULT_CHAIN).slug } }">⌂ <span class="label">Home</span></RouterLink>
      <RouterLink class="nav" :class="{ on: route.name === 'agents' }" :to="{ name: 'agents', params: { slug: (chain ?? DEFAULT_CHAIN).slug } }"># <span class="label">Explore</span></RouterLink>
      <div class="s-chains">
        <button v-for="c in CHAINS" :key="c.slug" :class="{ ghost: c.slug !== chain?.slug }" @click="switchTo(c.slug)">{{ c.shortName }}</button>
      </div>
      <p v-if="chain" class="soft label" style="font-size: 12px; margin-top: 12px" :title="sourceText(resolved)?.detail">via {{ sourceText(resolved)?.label ?? '…' }}</p>
    </nav>
    <template v-if="slug && !chain">
      <main class="s-main">
        <header class="s-head"><h1>Hmm…</h1></header>
        <p class="s-empty">“{{ slug }}” doesn't exist. Try <template v-for="c in CHAINS" :key="c.slug"><RouterLink :to="{ name: 'agents', params: { slug: c.slug } }">{{ c.name }}</RouterLink> </template></p>
      </main>
    </template>
    <RouterView v-else :key="route.path" />
  </div>
</template>
