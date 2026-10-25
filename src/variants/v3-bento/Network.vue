<script setup lang="ts">
import { computed } from 'vue'
import { valueHistogram } from '../../data/chartData'
import { formatNumber, formatPercent, formatScore, formatTimeline, shortAddress } from '../../format'
import { gini, labelsText, topShare, velocity } from '../shared/metrics'
import { routes, useChain, useNetwork } from '../shared/use'
import Heat from './Heat.vue'
import Ring from './Ring.vue'

const props = defineProps<{ slug: string }>()
const chain = useChain(() => props.slug)
const to = routes(() => chain.value)
const { feed, error, loading, load, stats, ecosystem } = useNetwork(chain)

const hist = computed(() => {
  const cols = valueHistogram((feed.value?.items ?? []).filter((r) => !r.revoked).map((r) => r.value))
  const n = cols.map((c) => c.segments.reduce((a, s) => a + s.value, 0))
  const max = Math.max(1, ...n)
  return cols.map((c, i) => ({ label: c.label, n: n[i], h: (n[i] / max) * 100 }))
})
const conc = computed(() => {
  const per = new Map<string, number>()
  for (const r of feed.value?.items ?? []) per.set(String(r.tokenId), (per.get(String(r.tokenId)) ?? 0) + 1)
  return { gini: gini([...per.values()]), top10: topShare([...per.values()], 10) }
})
const health = computed(() => {
  // 100 minus penalties: perfect-score inflation, suspect share, concentration.
  const s = stats.value
  if (!s) return null
  const suspect = s.suspects.length / Math.max(1, s.reviewers)
  return Math.max(0, Math.round(100 - 40 * Math.max(0, (s.perfectShare ?? 0) - 0.5) * 2 - 40 * Math.min(1, suspect * 2) - 20 * (conc.value.gini ?? 0)))
})
</script>

<template>
  <p v-if="error" class="b-notice">Could not load the feed: {{ error }} <button @click="load()">Retry</button></p>
  <p v-else-if="!stats" class="soft">Reading the latest feedback…</p>
  <div v-if="stats && feed" class="b-grid">
    <section class="b-card s4 b-hero" style="display: flex; gap: 16px; align-items: center">
      <Ring :value="health" :size="130" color="#fff" label="health" />
      <div>
        <h3>{{ chain.name }}</h3>
        <p class="b-mid">Feedback health</p>
        <p class="soft" style="margin: 4px 0 0" title="100 − 40 × perfect-score inflation above 50% − 40 × suspect share (×2) − 20 × agent Gini">penalised for 100s, suspects and concentration</p>
      </div>
    </section>
    <section class="b-card s2"><h3>Feedback</h3><p class="b-big">{{ stats.rows }}</p><p class="soft">{{ formatNumber(velocity(feed.items.map((r) => r.createdAt))) }}/day</p></section>
    <section class="b-card s2"><h3>Agents</h3><p class="b-big">{{ stats.agents }}</p><p class="soft">top 10 take {{ formatPercent(conc.top10) }}</p></section>
    <section class="b-card s2"><h3>Reviewers</h3><p class="b-big">{{ stats.reviewers }}</p><p class="soft">{{ formatNumber(stats.rows / Math.max(1, stats.reviewers)) }} each</p></section>
    <section class="b-card s2 b-dark"><h3>Average</h3><p class="b-big">{{ formatNumber(stats.average) }}</p><p class="soft">eco {{ formatNumber(ecosystem.data.value?.averageFeedback) }}</p></section>

    <section class="b-card s5">
      <h3>Values given</h3>
      <div class="b-bars"><span v-for="h in hist" :key="h.label" :style="{ height: `${h.h}%` }" :title="`${h.label}: ${h.n}`" /></div>
      <p class="soft" style="margin: 8px 0 0">{{ formatPercent(stats.perfectShare) }} are a perfect 100<span v-if="(stats.perfectShare ?? 0) > 0.7" class="warn"> — inflated</span></p>
    </section>
    <section class="b-card s7"><h3>When the network gives feedback</h3><Heat :times="feed.items.map((r) => r.createdAt)" /></section>

    <section class="b-card s4 r2">
      <h3>Suspect reviewers · {{ stats.suspects.length }}</h3>
      <ul class="b-list">
        <li v-for="s in stats.suspects.slice(0, 14)" :key="s.client">
          <RouterLink :to="to.reviewer(s.client)" class="b-mono">{{ shortAddress(s.client) }}</RouterLink>
          <span class="grow soft">{{ labelsText(s.labels) }}</span>
          <b>{{ s.rows }}</b>
        </li>
        <li v-if="!stats.suspects.length" class="good">None in this window.</li>
      </ul>
    </section>
    <section class="b-card s4">
      <h3>Busiest agents</h3>
      <ul class="b-list">
        <li v-for="a in stats.topAgents.slice(0, 6)" :key="a.tokenId.toString()">
          <RouterLink :to="to.agent(a.tokenId)" class="grow">{{ a.agentName ?? `Agent #${a.tokenId}` }}</RouterLink>
          <span class="soft">{{ a.reviewers }} fb.</span><b>{{ a.rows }}</b>
        </li>
      </ul>
    </section>
    <section class="b-card s4 b-tint">
      <h3>Lookalike rings · {{ stats.lookalikes.length }}</h3>
      <div v-for="(g, i) in stats.lookalikes.slice(0, 4)" :key="i" style="margin-bottom: 10px">
        <RouterLink v-for="a in g.agents" :key="a.tokenId.toString()" :to="to.agent(a.tokenId)" class="b-pill">{{ a.agentName ?? `#${a.tokenId}` }}</RouterLink>
        <div class="soft" style="font-size: 12px">{{ g.reviewers.length }} shared reviewers · {{ formatPercent(g.similarity) }} overlap</div>
      </div>
      <p v-if="!stats.lookalikes.length" class="soft">No groups.</p>
    </section>
    <section class="b-card s8">
      <h3>Latest feedback</h3>
      <div class="b-feed" style="max-height: 300px">
        <div v-for="(r, i) in feed.items.slice(0, 60)" :key="i" class="b-fb b-row" :class="{ revoked: r.revoked }" style="cursor: default">
          <span class="val">{{ formatScore(r.value) }}</span>
          <RouterLink :to="to.agent(r.tokenId)" style="flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">{{ r.agentName ?? `Agent #${r.tokenId}` }}</RouterLink>
          <RouterLink :to="to.reviewer(r.client)" class="b-mono">{{ shortAddress(r.client) }}</RouterLink>
          <span class="soft">{{ r.createdAt ? formatTimeline(r.createdAt) : '' }}</span>
        </div>
      </div>
    </section>
    <section class="b-card s12" style="text-align: center">
      <button v-if="feed.cursor" :disabled="loading" @click="load(true)">{{ loading ? 'Loading…' : 'Widen the window: load older feedback' }}</button>
      <span v-else class="soft">This is everything the source holds.</span>
    </section>
  </div>
</template>
