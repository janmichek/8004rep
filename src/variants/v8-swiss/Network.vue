<script setup lang="ts">
import { formatNumber, formatPercent, formatScore, formatTimeline, shortAddress } from '../../format'
import { labelsText } from '../shared/metrics'
import { routes, useChain, useNetwork } from '../shared/use'

const props = defineProps<{ slug: string }>()
const chain = useChain(() => props.slug)
const to = routes(() => chain.value)
const { feed, error, loading, load, stats } = useNetwork(chain)
</script>

<template>
  <p v-if="error" class="w-red">{{ error }} <button @click="load()">Retry</button></p>
  <p v-else-if="!stats" class="w-hero soft">…</p>
  <template v-if="stats && feed">
    <div class="w-grid">
      <div style="grid-column: span 7">
        <p class="w-hero" :class="{ 'w-red': (stats.perfectShare ?? 0) > 0.7 }">{{ formatPercent(stats.perfectShare) }}</p>
        <p class="w-sentence">of the latest {{ stats.rows }} reviews on {{ chain.name }} are a perfect 100.</p>
      </div>
      <div style="grid-column: span 5; align-self: end">
        <div class="w-cell"><span class="w-label">Suspect reviewers</span><p class="w-big" :class="{ 'w-red': stats.suspects.length }">{{ stats.suspects.length }}</p></div>
        <div class="w-cell"><span class="w-label">Average value</span><p class="w-big">{{ formatNumber(stats.average) }}</p></div>
      </div>
    </div>
    <p><button v-if="feed.cursor" :disabled="loading" @click="load(true)">{{ loading ? 'Loading' : 'Load older' }}</button></p>

    <div class="w-grid">
      <section style="grid-column: span 6">
        <h2 class="w-h">Suspects</h2>
        <p v-if="!stats.suspects.length" class="soft">None.</p>
        <div v-for="s in stats.suspects.slice(0, 20)" :key="s.client" class="w-row" style="grid-template-columns: 2fr 3fr 1fr">
          <RouterLink :to="to.reviewer(s.client)" class="mono">{{ shortAddress(s.client) }}</RouterLink>
          <span class="w-red">{{ labelsText(s.labels) }}</span>
          <span class="r">{{ s.rows }}</span>
        </div>
      </section>
      <section style="grid-column: span 6">
        <h2 class="w-h">Rings</h2>
        <p v-if="!stats.lookalikes.length" class="soft">None.</p>
        <div v-for="(g, i) in stats.lookalikes.slice(0, 12)" :key="i" class="w-row" style="grid-template-columns: 5fr 1fr; white-space: normal">
          <span style="white-space: normal"><template v-for="a in g.agents" :key="a.tokenId.toString()"><RouterLink :to="to.agent(a.tokenId)">{{ a.agentName ?? a.tokenId }}</RouterLink>&ensp;</template></span>
          <span class="r">{{ formatPercent(g.similarity) }}</span>
        </div>
      </section>
    </div>
    <h2 class="w-h">Latest</h2>
    <div v-for="(r, i) in feed.items.slice(0, 40)" :key="i" class="w-row" :class="{ revoked: r.revoked }">
      <RouterLink :to="to.agent(r.tokenId)">{{ r.agentName ?? `Agent ${r.tokenId}` }}</RouterLink>
      <RouterLink :to="to.reviewer(r.client)" class="mono">{{ shortAddress(r.client) }}</RouterLink>
      <span class="r"><b>{{ formatScore(r.value) }}</b></span>
      <span class="r soft">{{ r.tag1 ?? '' }}</span>
      <span class="r soft">{{ r.createdAt ? formatTimeline(r.createdAt) : '' }}</span>
    </div>
  </template>
</template>
