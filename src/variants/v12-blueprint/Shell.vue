<script setup lang="ts">
import { CHAINS, DEFAULT_CHAIN } from '../../chains'
import { sourceText, useChainSwitch, useRouteChain } from '../shared/use'

const { route, slug, chain, resolved } = useRouteChain()
const switchTo = useChainSwitch()
const group = (name: unknown) => (name === 'agent' ? 'agents' : name === 'reviewer' ? 'network' : name)
</script>

<template>
  <div class="bp-sheet">
    <span class="bp-mark tl" /><span class="bp-mark tr" /><span class="bp-mark bl" /><span class="bp-mark br" />
    <header class="bp-strip">
      <RouterLink class="bp-id" :to="{ name: 'agents', params: { slug: (chain ?? DEFAULT_CHAIN).slug } }">8004rep</RouterLink>
      <span class="bp-doc">PROJECT / ERC-8004 REPUTATION REGISTRY</span>
      <nav>
        <RouterLink :to="{ name: 'agents', params: { slug: (chain ?? DEFAULT_CHAIN).slug } }" :class="{ on: group(route.name) === 'agents' }">01 · parts schedule</RouterLink>
        <RouterLink :to="{ name: 'network', params: { slug: (chain ?? DEFAULT_CHAIN).slug } }" :class="{ on: group(route.name) === 'network' }">02 · system diagram</RouterLink>
      </nav>
      <span v-if="chain" class="bp-rev" :title="sourceText(resolved)?.detail">{{ sourceText(resolved)?.label ?? '…' }}</span>
    </header>
    <div class="bp-site">
      <span>SITE</span>
      <button v-for="c in CHAINS" :key="c.slug" :class="{ on: c.slug === chain?.slug }" @click="switchTo(c.slug)">{{ c.shortName }}</button>
    </div>
    <main class="bp-body">
      <template v-if="slug && !chain">
        <p class="bp-note err">SITE NOT FOUND: “{{ slug }}”</p>
        <p class="bp-prose">Available sites: <template v-for="c in CHAINS" :key="c.slug"><RouterLink :to="{ name: 'agents', params: { slug: c.slug } }">{{ c.slug }}</RouterLink> </template></p>
      </template>
      <RouterView v-else :key="`${group(route.name)}:${slug}`" />
    </main>
    <footer class="bp-titleblock">
      <div><span>PROJECT</span><b>8004 REPUTATION</b></div>
      <div><span>SITE</span><b>{{ chain?.name ?? '—' }}</b></div>
      <div><span>SHEET</span><b>{{ route.name === 'network' || route.name === 'reviewer' ? '02' : '01' }}</b></div>
      <div><span>SCALE</span><b>READ-ONLY</b></div>
      <div><span>REV</span><b>LIVE</b></div>
    </footer>
  </div>
</template>
