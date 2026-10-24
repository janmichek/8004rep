<script setup lang="ts">
import { CHAINS, DEFAULT_CHAIN } from '../../chains'
import { sourceText, useChainSwitch, useRouteChain } from '../shared/use'

const { route, slug, chain, resolved } = useRouteChain()
const switchTo = useChainSwitch()
const group = (name: unknown) => (name === 'agent' ? 'agents' : name === 'reviewer' ? 'network' : name)
</script>

<template>
  <div class="x-page">
    <header class="x-head">
      <div class="x-seal">8004<br /><small>REG.</small></div>
      <div class="x-mast">
        <p class="x-org">Municipal Registry · Department of Reputation</p>
        <RouterLink class="x-title" :to="{ name: 'agents', params: { slug: (chain ?? DEFAULT_CHAIN).slug } }">The Reputation <b>Archive</b></RouterLink>
        <p class="x-sub">Accession register and reading-room copies · open to the public</p>
      </div>
      <nav class="x-nav">
        <RouterLink :to="{ name: 'agents', params: { slug: (chain ?? DEFAULT_CHAIN).slug } }" :class="{ on: group(route.name) === 'agents' }">Accession register</RouterLink>
        <RouterLink :to="{ name: 'network', params: { slug: (chain ?? DEFAULT_CHAIN).slug } }" :class="{ on: group(route.name) === 'network' }">Reading room</RouterLink>
      </nav>
    </header>
    <div class="x-depot">
      <span>Depository</span>
      <button v-for="c in CHAINS" :key="c.slug" :class="{ on: c.slug === chain?.slug }" @click="switchTo(c.slug)">{{ c.name }}</button>
      <span v-if="chain" class="x-src" :title="sourceText(resolved)?.detail">{{ sourceText(resolved)?.label ?? '…' }}</span>
    </div>
    <main class="x-main">
      <template v-if="slug && !chain">
        <p class="x-kicker">No such depository</p>
        <h1 class="x-h1">“{{ slug }}” holds no records here.</h1>
        <p class="x-prose">Records are held at <template v-for="c in CHAINS" :key="c.slug"><RouterLink :to="{ name: 'agents', params: { slug: c.slug } }">{{ c.name }}</RouterLink><template v-if="c !== CHAINS.at(-1)">, </template></template>.</p>
      </template>
      <RouterView v-else :key="`${group(route.name)}:${slug}`" />
    </main>
    <footer class="x-foot">
      <span>Certified true copy · no record may be altered by this interface</span>
      <span>Retention: permanent</span>
    </footer>
  </div>
</template>
