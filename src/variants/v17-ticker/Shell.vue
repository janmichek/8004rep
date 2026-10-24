<script setup lang="ts">
import { CHAINS, DEFAULT_CHAIN } from '../../chains'
import { sourceText, useChainSwitch, useRouteChain } from '../shared/use'

const { route, slug, chain, resolved } = useRouteChain()
const switchTo = useChainSwitch()
const group = (name: unknown) => (name === 'agent' ? 'agents' : name === 'reviewer' ? 'network' : name)
</script>

<template>
  <div class="t-page">
    <header class="t-head">
      <div class="t-brand">
        <span class="t-dot" />REP<b>/</b>8004 <span class="t-dim">TERMINAL</span>
      </div>
      <nav class="t-nav">
        <RouterLink :to="{ name: 'agents', params: { slug: (chain ?? DEFAULT_CHAIN).slug } }" :class="{ on: group(route.name) === 'agents' }">LISTINGS</RouterLink>
        <RouterLink :to="{ name: 'network', params: { slug: (chain ?? DEFAULT_CHAIN).slug } }" :class="{ on: group(route.name) === 'network' }">MARKET</RouterLink>
      </nav>
      <div class="t-venue">
        <span class="t-dim">VENUE</span>
        <button v-for="c in CHAINS" :key="c.slug" :class="{ on: c.slug === chain?.slug }" @click="switchTo(c.slug)">{{ c.shortName.toUpperCase() }}</button>
      </div>
    </header>
    <div class="t-tape" aria-hidden="true">
      <div class="t-tape-in">
        <span v-for="n in 2" :key="n">
          <template v-for="c in CHAINS" :key="`${n}-${c.slug}`"><b>{{ c.shortName.toUpperCase() }}</b> {{ c.testnet ? 'TEST' : 'LIVE' }} <i class="t-up">▲</i> <span class="t-dim">AGENTS TRACKED · FEED REALTIME</span> &nbsp;&nbsp;</template>
        </span>
      </div>
    </div>
    <div v-if="chain" class="t-status">
      <span><span class="t-dim">FEED</span> {{ sourceText(resolved)?.label ?? '…' }}</span>
      <span><span class="t-dim">CHAIN</span> {{ chain.name.toUpperCase() }}</span>
      <span><span class="t-dim">UNITS</span> 0–100</span>
      <span class="t-src">{{ sourceText(resolved)?.detail }}</span>
    </div>
    <main class="t-main">
      <template v-if="slug && !chain">
        <p class="t-kicker">NO SUCH VENUE</p>
        <h1 class="t-h1">“{{ slug }}” is not listed.</h1>
        <p class="t-prose">Trading is open on <template v-for="c in CHAINS" :key="c.slug"><RouterLink :to="{ name: 'agents', params: { slug: c.slug } }">{{ c.name }}</RouterLink><template v-if="c !== CHAINS.at(-1)">, </template></template>.</p>
      </template>
      <RouterView v-else :key="`${group(route.name)}:${slug}`" />
    </main>
    <footer class="t-foot"><span>Prices are review scores, not securities.</span><span>Every quote derives from on-chain feedback; no order is ever placed.</span></footer>
  </div>
</template>
