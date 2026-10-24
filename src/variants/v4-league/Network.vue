<script setup lang="ts">
import { computed } from 'vue'
import { formatNumber, formatPercent, formatScore, formatTimeline, shortAddress } from '../../format'
import { LABEL_INFO } from '../../data/reviewerProfile'
import { labelsText, rankScore } from '../shared/metrics'
import { routes, useChain, useNetwork } from '../shared/use'
import { tierOf } from './league'

const props = defineProps<{ slug: string }>()
const chain = useChain(() => props.slug)
const to = routes(() => chain.value)
const { feed, error, loading, load, stats, ecosystem } = useNetwork(chain)
const prior = computed(() => stats.value?.average ?? 50)
// Window table: every agent seen in the window, ranked by shrunk average.
const table = computed(() => {
  const by = new Map<string, { tokenId: bigint; name?: string; n: number; sum: number; refs: Set<string> }>()
  for (const r of feed.value?.items ?? []) {
    if (r.revoked) continue
    const k = String(r.tokenId)
    const e = by.get(k) ?? { tokenId: r.tokenId, name: r.agentName, n: 0, sum: 0, refs: new Set<string>() }
    e.n++
    e.sum += r.value
    e.refs.add(r.client.toLowerCase())
    by.set(k, e)
  }
  return [...by.values()]
    .map((e) => {
      const pts = rankScore({ count: e.n, average: e.sum / e.n }, prior.value)
      return { ...e, avg: e.sum / e.n, pts, tier: tierOf(pts, e.n) }
    })
    .sort((a, b) => (b.pts ?? 0) - (a.pts ?? 0))
    .slice(0, 20)
})
const cards = computed(() => (stats.value?.suspects ?? []).map((s) => ({ ...s, red: s.labels.some((l) => LABEL_INFO[l].tone === 'warn') })))
</script>

<template>
  <div v-if="feed" class="g-ticker" aria-hidden="true">
    <span>
      <template v-for="(r, i) in feed.items.slice(0, 30)" :key="i">{{ r.agentName ?? `#${r.tokenId}` }} <b class="volt">{{ formatScore(r.value) }}</b> · </template>
    </span>
  </div>
  <h1 class="g-title" style="margin-top: 14px"><small>{{ chain.name }}</small>Season so far</h1>
  <p v-if="error" class="g-notice">{{ error }} <button @click="load()">Retry</button></p>
  <p v-else-if="!stats" class="soft">Loading the season…</p>
  <template v-if="stats && feed">
    <div class="g-stats">
      <div class="g-stat"><b>{{ stats.rows }}</b><small>Matches</small></div>
      <div class="g-stat"><b>{{ stats.agents }}</b><small>Players</small></div>
      <div class="g-stat"><b>{{ stats.reviewers }}</b><small>Referees</small></div>
      <div class="g-stat"><b>{{ formatNumber(stats.average) }}</b><small>Avg · eco {{ formatNumber(ecosystem.data.value?.averageFeedback) }}</small></div>
      <div class="g-stat"><b :class="{ volt: (stats.perfectShare ?? 0) > 0.7 }">{{ formatPercent(stats.perfectShare) }}</b><small>Perfect 100s</small></div>
      <div class="g-stat"><b>{{ stats.suspects.length }}</b><small>Carded refs</small></div>
    </div>
    <div class="g-two">
      <section class="g-panel">
        <h3>Window table</h3>
        <table class="g-table">
          <thead><tr><th>Pos</th><th>Player</th><th>Tier</th><th class="num">P</th><th class="num">Refs</th><th class="num">Avg</th><th class="num">Pts</th></tr></thead>
          <tbody>
            <tr v-for="(a, i) in table" :key="a.tokenId.toString()" :class="{ 'g-zone-up': i < 3 }">
              <td class="g-pos" :class="`p${i + 1}`">{{ i + 1 }}</td>
              <td><RouterLink :to="to.agent(a.tokenId)"><b>{{ a.name ?? `Agent #${a.tokenId}` }}</b></RouterLink></td>
              <td><span class="g-tier" :class="a.tier">{{ a.tier }}</span></td>
              <td class="num">{{ a.n }}</td>
              <td class="num" :style="{ color: a.refs.size === 1 && a.n > 2 ? 'var(--loss)' : '' }">{{ a.refs.size }}</td>
              <td class="num">{{ formatNumber(a.avg) }}</td>
              <td class="num g-pts">{{ formatNumber(a.pts) }}</td>
            </tr>
          </tbody>
        </table>
      </section>
      <div>
        <section class="g-panel">
          <h3>Disciplinary</h3>
          <p v-if="!cards.length" class="soft">Clean season: no referee carded.</p>
          <p v-for="s in cards.slice(0, 15)" :key="s.client" style="margin: 4px 0; display: flex; gap: 8px; align-items: center">
            <span :style="{ width: '12px', height: '16px', borderRadius: '2px', background: s.red ? 'var(--loss)' : 'var(--draw)', flex: 'none' }" />
            <RouterLink :to="to.reviewer(s.client)" class="mono">{{ shortAddress(s.client) }}</RouterLink>
            <span class="soft" style="flex: 1">{{ labelsText(s.labels) }}</span><b>{{ s.rows }}</b>
          </p>
        </section>
        <section class="g-panel">
          <h3>Fixed matches?</h3>
          <p class="soft" style="margin-top: -6px">Players refereed by nearly the same crowd (≥80% overlap).</p>
          <p v-if="!stats.lookalikes.length" class="soft">None found.</p>
          <div v-for="(g, i) in stats.lookalikes.slice(0, 6)" :key="i" style="margin-bottom: 8px">
            <RouterLink v-for="a in g.agents" :key="a.tokenId.toString()" :to="to.agent(a.tokenId)" class="g-chip">{{ a.agentName ?? `#${a.tokenId}` }}</RouterLink>
            <span class="soft">{{ g.reviewers.length }} refs · {{ formatPercent(g.similarity) }}</span>
          </div>
        </section>
      </div>
    </div>
    <section class="g-panel">
      <h3>Latest results</h3>
      <table class="g-table">
        <tbody>
          <tr v-for="(r, i) in feed.items.slice(0, 40)" :key="i" :class="{ revoked: r.revoked }">
            <td class="soft">{{ r.createdAt ? formatTimeline(r.createdAt) : '' }}</td>
            <td><RouterLink :to="to.agent(r.tokenId)">{{ r.agentName ?? `Agent #${r.tokenId}` }}</RouterLink></td>
            <td class="num g-pts" style="color: var(--ink)">{{ formatScore(r.value) }}</td>
            <td><RouterLink :to="to.reviewer(r.client)" class="mono soft">ref {{ shortAddress(r.client) }}</RouterLink></td>
          </tr>
        </tbody>
      </table>
      <p style="text-align: center"><button v-if="feed.cursor" :disabled="loading" @click="load(true)">{{ loading ? 'Loading…' : 'Earlier matchdays' }}</button></p>
    </section>
  </template>
</template>
