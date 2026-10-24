<script setup lang="ts">
import { computed, ref } from 'vue'
import { formatDate, formatNumber, formatPercent, formatScore, formatTimeline, shortAddress } from '../../format'
import { valueHistogram } from '../../data/chartData'
import { activeDays, asciiBar, gini, labelsText, topShare, velocity } from '../shared/metrics'
import { routes, useChain, useNetwork } from '../shared/use'
import Prompt from './Prompt.vue'

const props = defineProps<{ slug: string }>()
const chain = useChain(() => props.slug)
const to = routes(() => chain.value)
const { feed, error, loading, load, stats, ecosystem } = useNetwork(chain)

// Concentration over the whole window, not only the top 10 the classic page lists.
const extra = computed(() => {
  const items = feed.value?.items ?? []
  const perAgent = new Map<string, number>()
  for (const r of items) perAgent.set(r.tokenId.toString(), (perAgent.get(r.tokenId.toString()) ?? 0) + 1)
  const counts = [...perAgent.values()]
  return {
    gini: gini(counts),
    top10: topShare(counts, 10),
    revokeRate: items.length ? items.filter((r) => r.revoked).length / items.length : null,
    velocity: velocity(items.map((r) => r.createdAt)),
    days: activeDays(items.map((r) => r.createdAt)),
  }
})
const hist = computed(() => {
  const cols = valueHistogram((feed.value?.items ?? []).filter((r) => !r.revoked).map((r) => r.value))
  const counts = cols.map((c) => c.segments.reduce((a, s) => a + s.value, 0))
  const max = Math.max(1, ...counts)
  return cols.map((c, i) => ({ label: c.label, n: counts[i], bar: asciiBar(counts[i] / max, 30) }))
})
const tab = ref<'suspects' | 'rings' | 'busiest' | 'tail'>('suspects')
</script>

<template>
  <Prompt :cmd="`netstat --chain=${chain.slug} --window=${feed?.items.length ?? '…'}`" :busy="loading">
    <pre v-if="error" class="t-err">error: {{ error }} <button @click="load()">retry</button></pre>
    <pre v-else-if="!stats" class="dim">scanning latest feedback…</pre>
    <template v-else-if="feed">
      <div class="t-cols">
        <pre><span class="dim">reviews       </span><b class="hi">{{ stats.rows }}</b> <span class="dim">{{ stats.from && stats.to ? `${formatDate(stats.from)} → ${formatDate(stats.to)}` : '' }}</span>
<span class="dim">agents rated  </span>{{ stats.agents }}
<span class="dim">reviewers     </span>{{ stats.reviewers }} <span class="dim">({{ formatNumber(stats.rows / Math.max(1, stats.reviewers)) }} each)</span>
<span class="dim">average       </span>{{ formatNumber(stats.average) }} <span class="dim">ecosystem {{ formatNumber(ecosystem.data.value?.averageFeedback) }}</span>
<span class="dim">perfect 100s  </span><span :class="(stats.perfectShare ?? 0) > 0.7 ? 'amber' : ''">{{ formatPercent(stats.perfectShare) }}</span>
<span class="dim">suspects      </span><span :class="stats.suspects.length ? 'amber' : ''">{{ stats.suspects.length }}</span> <span class="dim">· {{ stats.lookalikes.length }} rings</span></pre>
        <pre><span class="dim">reviews/day   </span>{{ formatNumber(extra.velocity) }}
<span class="dim">active days   </span>{{ extra.days.days }} <span class="dim">(streak {{ extra.days.streak }})</span>
<span class="dim">revoke rate   </span>{{ formatPercent(extra.revokeRate) }}
<span class="dim">agent gini    </span>{{ formatNumber(extra.gini, 2) }} <span class="dim">how unevenly reviews land</span>
<span class="dim">top-10 share  </span>{{ formatPercent(extra.top10) }} <span class="dim">of reviews go to 10 agents</span></pre>
      </div>
      <pre class="dim" style="margin-top: 8px">values given (non-revoked):</pre>
      <pre v-for="h in hist" :key="h.label">  {{ h.label.padStart(7) }} <span class="cyan">{{ h.bar }}</span> {{ h.n }}</pre>
      <p>
        <button v-if="feed.cursor" :disabled="loading" @click="load(true)">{{ loading ? 'loading…' : 'fetch --older' }}</button>
        <span v-else class="dim">window holds everything the source has</span>
      </p>
    </template>
  </Prompt>

  <template v-if="stats && feed">
    <div class="t-tabs" role="tablist">
      <button v-for="t in (['suspects', 'rings', 'busiest', 'tail'] as const)" :key="t" role="tab" :aria-selected="tab === t" :class="{ on: tab === t }" @click="tab = t">{{ t }}</button>
    </div>
    <Prompt v-if="tab === 'suspects'" cmd="grep -E 'stamp|bulk|single' reviewers">
      <pre v-if="!stats.suspects.length" class="dim">(no reviewer trips a rule)</pre>
      <table v-else class="t-table">
        <thead><tr><th>reviewer</th><th class="num">n</th><th class="num">agents</th><th class="num">avg</th><th>rules</th></tr></thead>
        <tbody>
          <tr v-for="s in stats.suspects.slice(0, 50)" :key="s.client">
            <td><RouterLink :to="to.reviewer(s.client)">{{ shortAddress(s.client) }}</RouterLink></td>
            <td class="num">{{ s.rows }}</td><td class="num">{{ s.agents }}</td><td class="num">{{ formatNumber(s.average) }}</td>
            <td class="amber">{{ labelsText(s.labels) }}</td>
          </tr>
        </tbody>
      </table>
    </Prompt>
    <Prompt v-else-if="tab === 'rings'" cmd="rings --overlap=0.8 --shared=2">
      <pre class="dim">agents rated by nearly the same crowd: review rings, agent farms, or a test suite</pre>
      <pre v-if="!stats.lookalikes.length" class="dim">(none)</pre>
      <div v-for="(g, i) in stats.lookalikes.slice(0, 30)" :key="i" class="t-box">
        <pre><b class="hi">ring {{ i + 1 }}</b> <span class="dim">{{ g.agents.length }} agents · {{ g.reviewers.length }} reviewers · overlap {{ formatPercent(g.similarity) }}</span></pre>
        <pre>agents   <template v-for="a in g.agents" :key="a.tokenId.toString()"><RouterLink :to="to.agent(a.tokenId)">{{ a.agentName ?? `#${a.tokenId}` }}</RouterLink>  </template></pre>
        <pre class="dim">crowd    <template v-for="r in g.reviewers.slice(0, 8)" :key="r"><RouterLink :to="to.reviewer(r)">{{ shortAddress(r) }}</RouterLink> </template><template v-if="g.reviewers.length > 8">+{{ g.reviewers.length - 8 }}</template></pre>
      </div>
    </Prompt>
    <Prompt v-else-if="tab === 'busiest'" cmd="sort -rn agents | head">
      <table class="t-table">
        <thead><tr><th>agent</th><th class="num">n</th><th class="num">reviewers</th><th class="num">avg</th></tr></thead>
        <tbody>
          <tr v-for="a in stats.topAgents" :key="a.tokenId.toString()">
            <td><RouterLink :to="to.agent(a.tokenId)">{{ a.agentName ?? `agent-${a.tokenId}` }}</RouterLink> <span class="dim">#{{ a.tokenId }}</span></td>
            <td class="num">{{ a.rows }}</td>
            <td class="num" :class="{ amber: a.reviewers === 1 && a.rows > 2 }">{{ a.reviewers }}</td>
            <td class="num">{{ formatNumber(a.average) }}</td>
          </tr>
        </tbody>
      </table>
    </Prompt>
    <Prompt v-else cmd="tail -f feedback">
      <pre v-for="(r, i) in feed.items.slice(0, 100)" :key="i" :class="{ dim: r.revoked }"><span class="dim">{{ r.createdAt ? formatTimeline(r.createdAt).padStart(8) : '       -' }}</span> <RouterLink :to="to.reviewer(r.client)">{{ shortAddress(r.client) }}</RouterLink> → <RouterLink :to="to.agent(r.tokenId)">{{ r.agentName ?? `#${r.tokenId}` }}</RouterLink> <b class="hi">{{ formatScore(r.value) }}</b> <span class="dim">{{ [r.tag1, r.tag2].filter(Boolean).join(',') }}</span><span v-if="r.revoked" class="red"> revoked</span></pre>
    </Prompt>
  </template>
</template>
