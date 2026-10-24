<script setup lang="ts">
import { computed, ref } from 'vue'
import { formatNumber, formatPercent, formatScore, formatTimeline, shortAddress } from '../../format'
import { edgesOf, gini, labelsText, ring } from '../shared/metrics'
import { routes, useChain, useNetwork } from '../shared/use'
import { AGENT, REVIEWER, SUSPECT } from './orbit'

const props = defineProps<{ slug: string }>()
const chain = useChain(() => props.slug)
const to = routes(() => chain.value)
const { feed, error, loading, load, stats, ecosystem } = useNetwork(chain)

const S = 700
const MAX_AGENTS = 24
const MAX_REVIEWERS = 72
// Bipartite sky: the busiest agents on the inner ring, their reviewers on the outer one.
const graph = computed(() => {
  const items = feed.value?.items ?? []
  const edges = edgesOf(items)
  const agentRows = new Map<string, { tokenId: bigint; name?: string; n: number }>()
  for (const r of items) {
    const e = agentRows.get(String(r.tokenId)) ?? { tokenId: r.tokenId, name: r.agentName, n: 0 }
    e.n++
    agentRows.set(String(r.tokenId), e)
  }
  const agents = [...agentRows.values()].sort((a, b) => b.n - a.n).slice(0, MAX_AGENTS)
  const agentIds = new Set(agents.map((a) => String(a.tokenId)))
  const revRows = new Map<string, number>()
  for (const e of edges) if (agentIds.has(String(e.tokenId))) revRows.set(e.client, (revRows.get(e.client) ?? 0) + e.rows)
  // Order reviewers by the first agent they touch, so their edges stay short.
  const firstAgent = new Map<string, number>()
  agents.forEach((a, i) => edges.forEach((e) => e.tokenId === a.tokenId && !firstAgent.has(e.client) && firstAgent.set(e.client, i)))
  const reviewers = [...revRows.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_REVIEWERS)
    .sort((a, b) => (firstAgent.get(a[0]) ?? 0) - (firstAgent.get(b[0]) ?? 0))
  const sus = new Set((stats.value?.suspects ?? []).map((s) => s.client.toLowerCase()))
  const maxA = Math.max(1, ...agents.map((a) => a.n))
  const maxR = Math.max(1, ...reviewers.map((r) => r[1]))
  const aPos = new Map(agents.map((a, i) => [String(a.tokenId), { ...a, ...ring(i, agents.length, 170, S / 2, S / 2), r: 6 + 14 * Math.sqrt(a.n / maxA) }]))
  const rPos = new Map(reviewers.map(([c, n], i) => [c, { client: c, n, sus: sus.has(c), ...ring(i, reviewers.length, 310, S / 2, S / 2), r: 2.5 + 6 * Math.sqrt(n / maxR) }]))
  const lines = edges.filter((e) => aPos.has(String(e.tokenId)) && rPos.has(e.client)).map((e) => ({ ...e, a: aPos.get(String(e.tokenId))!, rv: rPos.get(e.client)! }))
  return { agents: [...aPos.values()], reviewers: [...rPos.values()], lines }
})

// Selecting a ring, agent or reviewer lights its part of the sky.
const focus = ref<{ agents: Set<string>; reviewers: Set<string> } | null>(null)
function focusRing(i: number): void {
  const g = stats.value?.lookalikes[i]
  focus.value = g ? { agents: new Set(g.agents.map((a) => String(a.tokenId))), reviewers: new Set(g.reviewers.map((r) => r.toLowerCase())) } : null
}
function focusAgent(id: string): void {
  const rs = graph.value.lines.filter((l) => String(l.tokenId) === id).map((l) => l.client)
  focus.value = { agents: new Set([id]), reviewers: new Set(rs) }
}
function focusReviewer(c: string): void {
  const as = graph.value.lines.filter((l) => l.client === c).map((l) => String(l.tokenId))
  focus.value = { agents: new Set(as), reviewers: new Set([c]) }
}
const lit = (kind: 'a' | 'r', id: string) => !focus.value || (kind === 'a' ? focus.value.agents : focus.value.reviewers).has(id)
const density = computed(() => {
  const g = graph.value
  return g.agents.length && g.reviewers.length ? g.lines.length / (g.agents.length * g.reviewers.length) : null
})
</script>

<template>
  <h1 class="o-title">{{ chain.name }} constellation</h1>
  <p class="o-sub">The {{ graph.agents.length }} busiest agents (inner ring) and the {{ graph.reviewers.length }} reviewers who rate them (outer ring), from the latest {{ feed?.items.length ?? '…' }} reviews.</p>
  <p v-if="error" class="o-notice">{{ error }} <button @click="load()">Retry</button></p>
  <p v-else-if="!stats" class="soft">Charting the sky…</p>
  <div v-if="stats && feed" class="o-stage">
    <div>
      <svg class="o-sky" :viewBox="`0 0 ${S} ${S}`" role="img" aria-label="Reviewer to agent graph" @click.self="focus = null">
        <line
          v-for="(l, i) in graph.lines"
          :key="i"
          :x1="l.a.x" :y1="l.a.y" :x2="l.rv.x" :y2="l.rv.y"
          :stroke="l.rv.sus ? SUSPECT : REVIEWER"
          :stroke-opacity="focus ? (lit('a', String(l.tokenId)) && lit('r', l.client) ? 0.7 : 0.02) : 0.12 + Math.min(0.5, l.rows / 20)"
          :stroke-width="Math.min(4, 0.5 + l.rows / 4)"
        />
        <g v-for="r in graph.reviewers" :key="r.client" class="node" :class="{ dim: !lit('r', r.client) }" tabindex="0" @click="focusReviewer(r.client)" @dblclick="$router.push(to.reviewer(r.client))">
          <title>{{ r.client }} · {{ r.n }} reviews{{ r.sus ? ' · suspect' : '' }} (double-click to open)</title>
          <circle :cx="r.x" :cy="r.y" :r="r.r" :fill="r.sus ? SUSPECT : REVIEWER" />
        </g>
        <g v-for="a in graph.agents" :key="String(a.tokenId)" class="node" :class="{ dim: !lit('a', String(a.tokenId)) }" tabindex="0" @click="focusAgent(String(a.tokenId))" @dblclick="$router.push(to.agent(a.tokenId))">
          <title>{{ a.name ?? `#${a.tokenId}` }} · {{ a.n }} reviews (double-click to open)</title>
          <circle :cx="a.x" :cy="a.y" :r="a.r" :fill="AGENT" />
          <text :x="a.x" :y="a.y - a.r - 4" text-anchor="middle">{{ (a.name ?? `#${a.tokenId}`).slice(0, 16) }}</text>
        </g>
      </svg>
      <div class="o-legend">
        <span><i :style="{ background: AGENT }" />agent (size = reviews)</span>
        <span><i :style="{ background: REVIEWER }" />reviewer</span>
        <span><i :style="{ background: SUSPECT }" />suspect reviewer</span>
        <span>click to focus · double-click to open · click empty sky to reset</span>
      </div>
    </div>
    <aside>
      <section class="o-panel">
        <h3>Sky readings</h3>
        <dl class="o-kv">
          <dt>Reviews</dt><dd>{{ stats.rows }}</dd>
          <dt>Agents / reviewers</dt><dd>{{ stats.agents }} / {{ stats.reviewers }}</dd>
          <dt>Average value</dt><dd>{{ formatNumber(stats.average) }} <span class="soft">eco {{ formatNumber(ecosystem.data.value?.averageFeedback) }}</span></dd>
          <dt>Perfect 100s</dt><dd>{{ formatPercent(stats.perfectShare) }}</dd>
          <dt title="Drawn edges / possible agent–reviewer pairs">Graph density</dt><dd>{{ formatPercent(density) }}</dd>
          <dt title="Gini of reviews per reviewer">Reviewer Gini</dt><dd>{{ formatNumber(gini(graph.reviewers.map((r) => r.n)), 2) }}</dd>
        </dl>
        <p style="margin: 10px 0 0"><button v-if="feed.cursor" :disabled="loading" @click="load(true)">{{ loading ? 'Charting…' : 'Look further back' }}</button></p>
      </section>
      <section class="o-panel">
        <h3>Rings · {{ stats.lookalikes.length }}</h3>
        <p v-if="!stats.lookalikes.length" class="soft">No agents share ≥80% of their reviewers.</p>
        <ul class="o-list">
          <li v-for="(g, i) in stats.lookalikes.slice(0, 20)" :key="i" style="cursor: pointer" @click="focusRing(i)">
            <span>{{ g.agents.map((a) => a.agentName ?? `#${a.tokenId}`).join(' · ') }}</span>
            <span class="soft">{{ g.reviewers.length }}r · {{ formatPercent(g.similarity) }}</span>
          </li>
        </ul>
      </section>
      <section class="o-panel">
        <h3>Suspects · {{ stats.suspects.length }}</h3>
        <ul class="o-list">
          <li v-for="s in stats.suspects.slice(0, 20)" :key="s.client" style="cursor: pointer" @click="focusReviewer(s.client.toLowerCase())">
            <RouterLink :to="to.reviewer(s.client)" class="mono" @click.stop>{{ shortAddress(s.client) }}</RouterLink>
            <span class="o-chip sus">{{ labelsText(s.labels) }}</span>
          </li>
        </ul>
      </section>
      <section class="o-panel">
        <h3>Latest signals</h3>
        <ul class="o-list">
          <li v-for="(r, i) in feed.items.slice(0, 25)" :key="i">
            <RouterLink :to="to.agent(r.tokenId)">{{ r.agentName ?? `#${r.tokenId}` }}</RouterLink>
            <b>{{ formatScore(r.value) }}</b><span class="soft">{{ r.createdAt ? formatTimeline(r.createdAt) : '' }}</span>
          </li>
        </ul>
      </section>
    </aside>
  </div>
</template>
