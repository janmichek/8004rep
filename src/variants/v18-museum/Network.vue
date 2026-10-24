<script setup lang="ts">
import { computed } from 'vue'
import { formatDate, formatNumber, formatPercent, formatScore, formatTimeline, shortAddress } from '../../format'
import { labelsText } from '../shared/metrics'
import { routes, useChain, useNetwork } from '../shared/use'
import { roomOf } from './museum'

const props = defineProps<{ slug: string }>()
const chain = useChain(() => props.slug)
const to = routes(() => chain.value)
const { feed, error, loading, load, stats, ecosystem } = useNetwork(chain)
const rooms = computed(() => {
  const bands = [
    { room: roomOf(95), from: 90, to: 100.1 },
    { room: roomOf(80), from: 75, to: 90 },
    { room: roomOf(65), from: 60, to: 75 },
    { room: roomOf(45), from: 40, to: 60 },
    { room: roomOf(20), from: -Infinity, to: 40 },
    { room: roomOf(null), from: Infinity, to: Infinity },
  ]
  const values = (stats.value?.topAgents ?? []).map((a) => a.average)
  const all: (number | null)[] = values
  return bands.map((b) => ({
    ...b,
    count: all.filter((v) => (v === null ? b.from === Infinity : v >= b.from && v < b.to)).length,
  }))
})
const maxRoom = computed(() => Math.max(1, ...rooms.value.map((r) => r.count)))
</script>

<template>
  <p class="m-kicker">Collection · {{ chain.name }}</p>
  <h1 class="m-h1">A guide to the collection</h1>
  <p class="m-lede">
    {{ stats?.rows ?? '…' }} recorded visits, {{ stats?.reviewers ?? '…' }} visitors and {{ stats?.agents ?? '…' }} works in
    this wing. Rooms are assigned by trusted mean; a work can move rooms as new ratings arrive.
  </p>

  <p v-if="error" class="m-err">{{ error }} <button @click="load()">Retry</button></p>
  <p v-else-if="!stats" class="m-empty">Unlocking the galleries…</p>
  <template v-else>
    <div class="m-tiles">
      <div><small>Visitor entries</small><b>{{ stats.rows }}</b></div>
      <div><small>Mean rating</small><b>{{ formatNumber(stats.average) }}</b></div>
      <div><small>Perfect scores</small><b>{{ formatPercent(stats.perfectShare) }}</b></div>
      <div><small>Withdrawn</small><b>{{ stats.revoked }}</b></div>
    </div>
    <p class="m-prose" style="font-size: 13px">
      <template v-if="stats.from && stats.to">The season ran {{ formatDate(stats.from) }} to {{ formatDate(stats.to) }}. </template>
      The wider collection benchmark is {{ formatNumber(ecosystem.data.value?.averageFeedback) }}.
    </p>

    <div class="m-columns">
      <div>
        <h2 class="m-h2" style="margin-top: 0">Rooms on this floor</h2>
        <table class="m-table">
          <thead><tr><th>Room</th><th>Rule</th><th>Aisle</th><th class="num">Works</th></tr></thead>
          <tbody>
            <tr v-for="r in rooms" :key="r.room.id">
              <td><b>{{ r.room.id }}</b> — {{ r.room.name.replace(/^Room [IVX]+ — /, '') }}</td>
              <td class="soft">{{ r.room.note }}</td>
              <td>
                <span style="display: inline-block; width: 120px; height: 7px; background: var(--m-rule); vertical-align: middle">
                  <span :style="{ display: 'block', height: '100%', width: `${(r.count / maxRoom) * 100}%`, background: 'var(--m-gold)' }" />
                </span>
              </td>
              <td class="num">{{ r.count }}</td>
            </tr>
          </tbody>
        </table>
        <p class="m-prose" style="font-size: 12px; margin-top: 8px">Room counts come from the works on this page of the collection feed, not the whole chain.</p>

        <h2 class="m-h2">Most visited works</h2>
        <table class="m-table">
          <thead><tr><th>Work</th><th>Room</th><th class="num">Visits</th><th class="num">Visitors</th><th class="num">Mean</th></tr></thead>
          <tbody>
            <tr v-for="a in stats.topAgents.slice(0, 12)" :key="a.tokenId.toString()">
              <td><RouterLink :to="to.agent(a.tokenId)">{{ a.agentName ?? `Agent ${a.tokenId}` }}</RouterLink></td>
              <td class="soft">{{ roomOf(a.average).id }}</td>
              <td class="num">{{ a.rows }}</td>
              <td class="num">{{ a.reviewers }}</td>
              <td class="num">{{ formatNumber(a.average) }}</td>
            </tr>
          </tbody>
        </table>

        <h2 class="m-h2">Recent entries</h2>
        <div v-if="!feed" class="m-empty">…</div>
        <template v-else>
          <div class="m-entry head" style="grid-template-columns: 1.4fr 1fr 66px 84px"><span>Work</span><span>Visitor</span><span class="num">Score</span><span class="num">When</span></div>
          <div v-for="(r, i) in feed.items.slice(0, 50)" :key="i" class="m-entry" style="grid-template-columns: 1.4fr 1fr 66px 84px" :class="{ revoked: r.revoked }">
            <RouterLink :to="to.agent(r.tokenId)">{{ r.agentName ?? `Agent ${r.tokenId}` }}</RouterLink>
            <RouterLink :to="to.reviewer(r.client)" class="m-mono">{{ shortAddress(r.client) }}</RouterLink>
            <span class="num">{{ formatScore(r.value) }}</span>
            <span class="num soft">{{ r.createdAt ? formatTimeline(r.createdAt) : '—' }}</span>
          </div>
          <nav class="m-pager"><span /><button v-if="feed.cursor" :disabled="loading" @click="load(true)">{{ loading ? 'Fetching…' : 'Earlier entries' }}</button><span /></nav>
        </template>
      </div>

      <aside class="m-side">
        <h2 class="m-h2" style="margin-top: 0">Conservation concerns</h2>
        <p v-if="!stats.suspects.length" class="m-empty">No concerns are recorded.</p>
        <ul v-else class="m-list">
          <li v-for="s in stats.suspects.slice(0, 12)" :key="s.client" style="display: block">
            <div><RouterLink :to="to.reviewer(s.client)" class="m-mono">{{ shortAddress(s.client) }}</RouterLink></div>
            <div class="m-warn" style="font-size: 12px">{{ labelsText(s.labels) }} · {{ s.rows }} visits / {{ s.agents }} works</div>
          </li>
        </ul>

        <h2 class="m-h2">Shared provenance</h2>
        <p v-if="!stats.lookalikes.length" class="m-empty">No two works share their visitors.</p>
        <ul v-else class="m-list">
          <li v-for="(g, i) in stats.lookalikes.slice(0, 8)" :key="i" style="display: block">
            <div>
              <template v-for="a in g.agents" :key="a.tokenId.toString()">
                <RouterLink :to="to.agent(a.tokenId)">{{ a.agentName ?? `#${a.tokenId}` }}</RouterLink><template v-if="a !== g.agents.at(-1)"> · </template>
              </template>
            </div>
            <div class="soft" style="font-size: 11px">{{ formatPercent(g.similarity) }} shared visitors</div>
          </li>
        </ul>

        <h2 class="m-h2">A note on the rooms</h2>
        <p class="m-prose" style="font-size: 13px">
          Rooms use the trusted mean, not the raw one. Open a work to see the treatment that moves it between rooms.
        </p>
      </aside>
    </div>
  </template>
</template>
