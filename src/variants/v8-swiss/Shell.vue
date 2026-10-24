<script setup lang="ts">
import { CHAINS, DEFAULT_CHAIN } from '../../chains'
import { sourceText, useChainSwitch, useRouteChain } from '../shared/use'

const { route, slug, chain, resolved } = useRouteChain()
const switchTo = useChainSwitch()
</script>

<template>
  <div class="w-wrap">
    <header class="w-top">
      <RouterLink class="brand" :to="{ name: 'agents', params: { slug: (chain ?? DEFAULT_CHAIN).slug } }">8004rep</RouterLink>
      <nav>
        <RouterLink :to="{ name: 'agents', params: { slug: (chain ?? DEFAULT_CHAIN).slug } }" :class="{ on: route.name === 'agents' }">Agents</RouterLink>
        <RouterLink :to="{ name: 'network', params: { slug: (chain ?? DEFAULT_CHAIN).slug } }" :class="{ on: route.name === 'network' }">Network</RouterLink>
        <span v-if="chain" class="soft" style="font-size: 13px" :title="sourceText(resolved)?.detail">{{ sourceText(resolved)?.label ?? '…' }}</span>
      </nav>
      <div class="chains"><button v-for="c in CHAINS" :key="c.slug" :class="{ on: c.slug === chain?.slug }" @click="switchTo(c.slug)">{{ c.name }}</button></div>
    </header>
    <template v-if="slug && !chain">
      <p class="w-hero w-red">404</p>
      <p class="w-sentence">There is no network called “{{ slug }}”.</p>
      <p><template v-for="c in CHAINS" :key="c.slug"><RouterLink :to="{ name: 'agents', params: { slug: c.slug } }">{{ c.name }}</RouterLink>&emsp;</template></p>
    </template>
    <RouterView v-else :key="route.path" />
  </div>
</template>
