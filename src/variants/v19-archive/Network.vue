<script setup lang="ts">
import { computed } from 'vue'
import { formatDate, formatNumber, formatPercent, formatScore, formatTimeline, shortAddress } from '../../format'
import { labelsText } from '../shared/metrics'
import { routes, useChain, useNetwork } from '../shared/use'
import { seriesOf } from './archive'

const props = defineProps<{ slug: string }>()
const chain = useChain(() => props.slug)
const to = routes(() => chain.value)
const { feed, error, loading, load, stats, ecosystem } = useNetwork(chain)
const series = computed(() => {
  const rows = ['A', 'B', 'C', 'D', 'E', 'U'].map((code) => ({ code, count: 0, name: '' }))
  for (const a of stats.value?.topAgents ?? []) {
    const s = seriesOf(a.average)
    const row = rows.find((r) => r.code === s.code)
    if (row) {
      row.count++
      row.name = s.name
    }
  }
  return rows
})
const maxSeries = computed(() => Math.max(1, ...series.value.map((s) => s.count)))
</script>

<template>
  <p class="x-kicker">Reading room · {{ chain.name }}</p>
  <h1 class="x-h1">Guide to the holdings</h1>
  <p class="x-lede">
    {{ stats?.rows ?? '…' }} items were consulted by {{ stats?.reviewers ?? '…' }} readers across {{ stats?.agents ?? '…' }} records.
    The series table is drawn from the records on this page of the register; the rest of the guide counts the full window.
  </p>

  <p v-if="error" class="x-err">{{ error }} <button @click="load()">Retry</button></p>
  <p v-else-if="!stats" class="x-empty">Opening the reading room…</p>
  <template v-else>
    <div class="x-tiles">
      <div><small>Items consulted</small><b>{{ stats.rows }}</b></div>
      <div><small>Mean score</small><b>{{ formatNumber(stats.average) }}</b></div>
      <div><small>Perfect items</small><b>{{ formatPercent(stats.perfectShare) }}</b></div>
      <div><small>Withdrawn</small><b>{{ stats.revoked }}</b></div>
    </div>
    <p class="x-prose" style="font-size: 11.5px">
      <template v-if="stats.from && stats.to">The consultation window runs {{ formatDate(stats.from) }} to {{ formatDate(stats.to) }}. </template>
      The wider registry benchmark is {{ formatNumber(ecosystem.data.value?.averageFeedback) }}.
    </p>

    <div class="x-columns">
      <div>
        <h2 class="x-h2" style="margin-top: 0">Series of the records on this page</h2>
        <table class="x-table">
          <thead><tr><th>Series</th><th>Name</th><th>Rule</th><th>Holdings</th><th class="num">Records</th></tr></thead>
          <tbody>
            <tr v-for="s in series" :key="s.code">
              <td><b>{{ s.code }}</b></td>
              <td>{{ s.name || '—' }}</td>
              <td class="soft">{{ seriesOf(s.code === 'U' ? null : s.code === 'A' ? 95 : s.code === 'B' ? 80 : s.code === 'C' ? 65 : s.code === 'D' ? 45 : 20).rule }}</td>
              <td>
                <span style="display: inline-block; width: 100px; height: 6px; background: var(--x-rule)">
                  <span :style="{ display: 'block', height: '100%', width: `${(s.count / maxSeries) * 100}%`, background: 'var(--x-red)' }" />
                </span>
              </td>
              <td class="num">{{ s.count }}</td>
            </tr>
          </tbody>
        </table>

        <h2 class="x-h2">Most consulted records</h2>
        <table class="x-table">
          <thead><tr><th>Call</th><th>Record</th><th class="num">Consulted</th><th class="num">Readers</th><th class="num">Mean</th><th>Series</th></tr></thead>
          <tbody>
            <tr v-for="a in stats.topAgents.slice(0, 12)" :key="a.tokenId.toString()">
              <td class="call">8004/{{ String(a.tokenId).padStart(4, '0') }}</td>
              <td><RouterLink :to="to.agent(a.tokenId)">{{ a.agentName ?? `Agent ${a.tokenId}` }}</RouterLink></td>
              <td class="num">{{ a.rows }}</td>
              <td class="num">{{ a.reviewers }}</td>
              <td class="num">{{ formatNumber(a.average) }}</td>
              <td><span class="x-stamp" :class="seriesOf(a.average).tone" style="font-size: 8px">{{ seriesOf(a.average).code }}</span></td>
            </tr>
          </tbody>
        </table>

        <h2 class="x-h2">Recent deposits</h2>
        <div v-if="!feed" class="x-empty">…</div>
        <template v-else>
          <div class="x-item head" style="grid-template-columns: 1.5fr 1fr 58px 84px"><span>Record</span><span>Depositor</span><span class="num">Score</span><span class="num">When</span></div>
          <div v-for="(r, i) in feed.items.slice(0, 50)" :key="i" class="x-item" style="grid-template-columns: 1.5fr 1fr 58px 84px" :class="{ revoked: r.revoked }">
            <RouterLink :to="to.agent(r.tokenId)">{{ r.agentName ?? `Agent ${r.tokenId}` }}</RouterLink>
            <RouterLink :to="to.reviewer(r.client)" class="x-mono">{{ shortAddress(r.client) }}</RouterLink>
            <span class="num">{{ formatScore(r.value) }}</span>
            <span class="num soft">{{ r.createdAt ? formatTimeline(r.createdAt) : '—' }}</span>
          </div>
          <nav class="x-pager"><span /><button v-if="feed.cursor" :disabled="loading" @click="load(true)">{{ loading ? 'Retrieving…' : 'Earlier deposits' }}</button><span /></nav>
        </template>
      </div>

      <aside class="x-side">
        <span class="x-tape">Reading room rules posted at the desk</span>
        <h2 class="x-h2">Restricted records</h2>
        <p v-if="!stats.suspects.length" class="x-empty">No depositor pattern is restricted.</p>
        <ul v-else class="x-list">
          <li v-for="s in stats.suspects.slice(0, 12)" :key="s.client" style="display: block">
            <div><RouterLink :to="to.reviewer(s.client)" class="x-mono">{{ shortAddress(s.client) }}</RouterLink></div>
            <div class="x-flag" style="font-size: 10.5px">{{ labelsText(s.labels) }} · {{ s.rows }} items / {{ s.agents }} records</div>
          </li>
        </ul>

        <h2 class="x-h2">Duplicate files</h2>
        <p v-if="!stats.lookalikes.length" class="x-empty">No two records share their depositors.</p>
        <ul v-else class="x-list">
          <li v-for="(g, i) in stats.lookalikes.slice(0, 8)" :key="i" style="display: block">
            <div>
              <template v-for="a in g.agents" :key="a.tokenId.toString()">
                <RouterLink :to="to.agent(a.tokenId)">{{ a.agentName ?? `#${a.tokenId}` }}</RouterLink><template v-if="a !== g.agents.at(-1)"> / </template>
              </template>
            </div>
            <div class="soft" style="font-size: 10.5px">{{ formatPercent(g.similarity) }} shared depositors</div>
          </li>
        </ul>

        <h2 class="x-h2">A note for readers</h2>
        <p class="x-prose" style="font-size: 11.5px">
          A series is a filing convenience, not a judgement of the record's keeper. Open any call number for the full
          treatment and the item list.
        </p>
      </aside>
    </div>
  </template>
</template>
