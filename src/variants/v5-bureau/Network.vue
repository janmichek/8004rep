<script setup lang="ts">
import { computed } from 'vue'
import { formatDate, formatNumber, formatPercent, formatScore, shortAddress } from '../../format'
import { labelsText } from '../shared/metrics'
import { routes, useChain, useNetwork } from '../shared/use'
import { GRADES, provisionalGrade } from './grade'

const props = defineProps<{ slug: string }>()
const chain = useChain(() => props.slug)
const to = routes(() => chain.value)
const { feed, error, loading, load, stats, ecosystem } = useNetwork(chain)
// Provisional grade of every agent seen in the window.
const grades = computed(() => {
  const by = new Map<string, { n: number; sum: number }>()
  for (const r of feed.value?.items ?? []) {
    if (r.revoked) continue
    const e = by.get(String(r.tokenId)) ?? { n: 0, sum: 0 }
    e.n++
    e.sum += r.value
    by.set(String(r.tokenId), e)
  }
  const n = Object.fromEntries(GRADES.map((g) => [g, 0])) as Record<string, number>
  for (const e of by.values()) n[provisionalGrade({ count: e.n, average: e.sum / e.n })]++
  const max = Math.max(1, ...Object.values(n))
  return GRADES.map((g) => ({ g, n: n[g], w: (n[g] / max) * 100 }))
})
const revokeRate = computed(() => (stats.value ? stats.value.revoked / Math.max(1, stats.value.rows) : null))
</script>

<template>
  <section class="u-sec">
    <h2><span>§B</span> Statistical bulletin · {{ chain.name }}</h2>
    <p v-if="error" class="u-notice">{{ error }} <button @click="load()">Retry</button></p>
    <p v-else-if="!stats" class="soft mono">Compiling…</p>
    <template v-if="stats && feed">
      <div class="u-fields">
        <div class="u-field"><label>Reports in window</label><div>{{ stats.rows }}</div><small>{{ stats.from && stats.to ? `${formatDate(stats.from)} – ${formatDate(stats.to)}` : '' }}</small></div>
        <div class="u-field"><label>Subjects reported</label><div>{{ stats.agents }}</div></div>
        <div class="u-field"><label>Reporting sources</label><div>{{ stats.reviewers }}</div></div>
        <div class="u-field"><label>Mean value</label><div>{{ formatNumber(stats.average) }}</div><small>ecosystem {{ formatNumber(ecosystem.data.value?.averageFeedback) }}</small></div>
        <div class="u-field"><label>Perfect 100s</label><div>{{ formatPercent(stats.perfectShare) }}</div></div>
        <div class="u-field"><label>Withdrawal rate</label><div>{{ formatPercent(revokeRate) }}</div></div>
      </div>
      <p class="mono" style="font-size: 11px">
        <button v-if="feed.cursor" :disabled="loading" @click="load(true)">{{ loading ? 'Compiling…' : 'Extend window' }}</button>
        <span v-else class="soft">Window covers every record held.</span>
      </p>
    </template>
  </section>
  <template v-if="stats && feed">
    <section class="u-sec">
      <h2><span>§B.1</span> Grade distribution of subjects (provisional)</h2>
      <div class="u-bars">
        <div v-for="g in grades" :key="g.g"><b :class="`u-g-${g.g}`">{{ g.g }}</b><i :style="{ width: `${g.w}%` }" /><span>{{ g.n }}</span></div>
      </div>
    </section>
    <section class="u-sec">
      <h2><span>§B.2</span> Sources under review · {{ stats.suspects.length }}</h2>
      <p v-if="!stats.suspects.length" class="mono soft">NONE</p>
      <table v-else class="u-table">
        <thead><tr><th>Source</th><th class="num">Reports</th><th class="num">Subjects</th><th class="num">Avg</th><th>Grounds</th></tr></thead>
        <tbody>
          <tr v-for="s in stats.suspects.slice(0, 50)" :key="s.client">
            <td><RouterLink :to="to.reviewer(s.client)">{{ shortAddress(s.client) }}</RouterLink></td>
            <td class="num">{{ s.rows }}</td><td class="num">{{ s.agents }}</td><td class="num">{{ formatNumber(s.average) }}</td>
            <td>{{ labelsText(s.labels) }}</td>
          </tr>
        </tbody>
      </table>
    </section>
    <section class="u-sec">
      <h2><span>§B.3</span> Linked subjects (shared sources ≥ 80%) · {{ stats.lookalikes.length }}</h2>
      <p v-if="!stats.lookalikes.length" class="mono soft">NONE</p>
      <table v-else class="u-table">
        <tbody>
          <tr v-for="(g, i) in stats.lookalikes.slice(0, 30)" :key="i">
            <td><template v-for="a in g.agents" :key="a.tokenId.toString()"><RouterLink :to="to.agent(a.tokenId)">{{ a.agentName ?? `#${a.tokenId}` }}</RouterLink>&nbsp; </template></td>
            <td class="num">{{ g.reviewers.length }} sources</td><td class="num">{{ formatPercent(g.similarity) }}</td>
          </tr>
        </tbody>
      </table>
    </section>
    <section class="u-sec">
      <h2><span>§B.4</span> Most reported subjects</h2>
      <table class="u-table">
        <thead><tr><th>Subject</th><th class="num">Reports</th><th class="num">Sources</th><th class="num">Avg</th><th>Prov. grade</th></tr></thead>
        <tbody>
          <tr v-for="a in stats.topAgents" :key="a.tokenId.toString()">
            <td><RouterLink :to="to.agent(a.tokenId)">{{ a.agentName ?? `AGENT ${a.tokenId}` }}</RouterLink></td>
            <td class="num">{{ a.rows }}</td><td class="num">{{ a.reviewers }}</td><td class="num">{{ formatNumber(a.average) }}</td>
            <td>{{ a.average === null ? 'NR' : provisionalGrade({ count: a.rows, average: a.average }) }}</td>
          </tr>
        </tbody>
      </table>
    </section>
    <section class="u-sec">
      <h2><span>§B.5</span> Latest reports</h2>
      <table class="u-table">
        <tbody>
          <tr v-for="(r, i) in feed.items.slice(0, 60)" :key="i" :class="{ revoked: r.revoked }">
            <td>{{ r.createdAt ? formatDate(r.createdAt) : '—' }}</td>
            <td><RouterLink :to="to.agent(r.tokenId)">{{ r.agentName ?? `AGENT ${r.tokenId}` }}</RouterLink></td>
            <td><RouterLink :to="to.reviewer(r.client)">{{ shortAddress(r.client) }}</RouterLink></td>
            <td class="num"><b>{{ formatScore(r.value) }}</b></td>
          </tr>
        </tbody>
      </table>
    </section>
  </template>
</template>
