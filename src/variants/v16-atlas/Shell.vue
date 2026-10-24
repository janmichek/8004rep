<script setup lang="ts">
import { CHAINS, DEFAULT_CHAIN } from '../../chains'
import { sourceText, useChainSwitch, useRouteChain } from '../shared/use'

const { route, slug, chain, resolved } = useRouteChain()
const switchTo = useChainSwitch()
const group = (name: unknown) => (name === 'agent' ? 'agents' : name === 'reviewer' ? 'network' : name)
</script>

<template>
  <div class="a-page">
    <header class="a-head">
      <div class="a-rose" aria-hidden="true">
        <svg viewBox="0 0 64 64" width="62" height="62">
          <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" stroke-width=".8" />
          <circle cx="32" cy="32" r="23" fill="none" stroke="currentColor" stroke-width=".4" stroke-dasharray="1 3" />
          <path d="M32 4 L37 32 L32 60 L27 32 Z" fill="var(--a-red)" opacity=".75" />
          <path d="M4 32 L32 27 L60 32 L32 37 Z" fill="currentColor" opacity=".35" />
          <text x="32" y="14" text-anchor="middle" font-size="7" fill="currentColor">N</text>
        </svg>
      </div>
      <div class="a-mast">
        <p class="a-imprint">Sheets of the known territories</p>
        <RouterLink class="a-title" :to="{ name: 'agents', params: { slug: (chain ?? DEFAULT_CHAIN).slug } }">The <i>Atlas</i> of Agent Territories</RouterLink>
      </div>
      <nav class="a-nav">
        <RouterLink :to="{ name: 'agents', params: { slug: (chain ?? DEFAULT_CHAIN).slug } }" :class="{ on: group(route.name) === 'agents' }">Gazetteer</RouterLink>
        <RouterLink :to="{ name: 'network', params: { slug: (chain ?? DEFAULT_CHAIN).slug } }" :class="{ on: group(route.name) === 'network' }">Survey</RouterLink>
      </nav>
    </header>
    <div class="a-region">
      <span>Region</span>
      <button v-for="c in CHAINS" :key="c.slug" :class="{ on: c.slug === chain?.slug }" @click="switchTo(c.slug)">{{ c.shortName }}</button>
      <span v-if="chain" class="a-src" :title="sourceText(resolved)?.detail">{{ sourceText(resolved)?.label ?? '…' }}</span>
    </div>
    <main class="a-main">
      <template v-if="slug && !chain">
        <p class="a-kicker">Beyond the sheet</p>
        <h1 class="a-h1">“{{ slug }}” is not a charted region.</h1>
        <p class="a-prose">The atlas covers <template v-for="c in CHAINS" :key="c.slug"><RouterLink :to="{ name: 'agents', params: { slug: c.slug } }">{{ c.name }}</RouterLink><template v-if="c !== CHAINS.at(-1)">, </template></template>.</p>
      </template>
      <RouterView v-else :key="`${group(route.name)}:${slug}`" />
    </main>
    <footer class="a-foot">
      <span>Scale 1 : 8004</span>
      <span class="a-scale"><i v-for="n in 5" :key="n" :class="{ dark: n % 2 }" /></span>
      <span>Every place is charted from on-chain records; positions are a reading aid, not geography.</span>
    </footer>
  </div>
</template>
