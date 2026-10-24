<script setup lang="ts">
import { computed } from 'vue'
import { formatDate, formatNumber, formatPercent, formatScore, formatTimeline, shortAddress } from '../../format'
import { labelsText } from '../shared/metrics'
import { routes, useChain, useNetwork } from '../shared/use'

const props = defineProps<{ slug: string }>()
const chain = useChain(() => props.slug)
const to = routes(() => chain.value)
const { feed, error, loading, load, stats } = useNetwork(chain)

// Families are the tag the observer chose; untagged sightings are their own group.
const families = computed(() => {
  const counts = new Map<string, { rows: number; sum: number; live: number }>()
  for (const r of feed.value?.items ?? []) {
    const key = r.tag1?.trim() || 'untagged'
    const e = counts.get(key) ?? { rows: 0, sum: 0, live: 0 }
    e.rows++
    if (!r.revoked) {
      e.sum += r.value
      e.live++
    }
    counts.set(key, e)
  }
  const total = (feed.value?.items ?? []).length || 1
  return [...counts.entries()]
    .map(([name, e]) => ({ name, rows: e.rows, share: e.rows / total, average: e.live ? e.sum / e.live : null }))
    .sort((a, b) => b.rows - a.rows)
    .slice(0, 10)
})
</script>

<template>
  <p class="h-kicker">Survey report · {{ chain.name }}</p>
  <h1 class="h-h1">A survey of recent sightings</h1>
  <p class="h-lede">
    {{ stats?.rows ?? '…' }} observations across {{ stats?.agents ?? '…' }} specimens and {{ stats?.reviewers ?? '…' }} observers.
    The survey treats each feedback event as a sighting; struck events are recorded but excluded from determinations.
  </p>

  <p v-if="error" class="h-err">{{ error }} <button @click="load()">Retry</button></p>
  <p v-else-if="!stats" class="h-empty">Walking the transect…</p>
  <template v-else>
    <div class="h-tiles">
      <div><small>Observations</small><b>{{ stats.rows }}</b></div>
      <div><small>Mean value</small><b>{{ formatNumber(stats.average) }}</b></div>
      <div><small>Perfect values</small><b>{{ formatPercent(stats.perfectShare) }}</b></div>
      <div><small>Struck</small><b>{{ stats.revoked }}</b></div>
    </div>
    <p class="h-empty">
      <template v-if="stats.from && stats.to">Survey window {{ formatDate(stats.from) }} to {{ formatDate(stats.to) }}.</template>
      {{ stats.reviewers }} observers visited {{ stats.agents }} specimens.
    </p>

    <div class="h-cols">
      <div>
        <h2 class="h-h2">Dominant families</h2>
        <p class="h-empty" style="font-size: 13px">Families are the <i>tag1</i> recorded with the sighting; untagged sightings have no family.</p>
        <table class="h-table">
          <thead><tr><th>Family</th><th class="num">Sightings</th><th class="num">Share</th><th class="num">Mean</th></tr></thead>
          <tbody>
            <tr v-for="f in families" :key="f.name">
              <td><i>{{ f.name }}</i></td>
              <td class="num">{{ f.rows }}</td>
              <td class="num">{{ formatPercent(f.share) }}</td>
              <td class="num">{{ formatNumber(f.average) }}</td>
            </tr>
          </tbody>
        </table>

        <h2 class="h-h2">Anomalous observers</h2>
        <p v-if="!stats.suspects.length" class="h-empty">No observer habits stand out.</p>
        <ul v-else class="h-notes">
          <li v-for="s in stats.suspects.slice(0, 16)" :key="s.client">
            <RouterLink :to="to.reviewer(s.client)" class="h-mono">{{ shortAddress(s.client) }}</RouterLink>
            — <i>{{ labelsText(s.labels) }}</i>, {{ s.rows }} sightings over {{ s.agents }} specimens, mean {{ formatNumber(s.average) }}.
          </li>
        </ul>

        <h2 class="h-h2">Associated occurrences</h2>
        <p v-if="!stats.lookalikes.length" class="h-empty">No specimens share their observer set.</p>
        <ul v-else class="h-notes">
          <li v-for="(g, i) in stats.lookalikes.slice(0, 10)" :key="i">
            {{ formatPercent(g.similarity) }} shared observers:
            <template v-for="a in g.agents" :key="a.tokenId.toString()">
              <RouterLink :to="to.agent(a.tokenId)"><i>{{ a.agentName ?? `#${a.tokenId}` }}</i></RouterLink><template v-if="a !== g.agents.at(-1)">, </template>
            </template>
          </li>
        </ul>

        <h2 class="h-h2">Recent sightings</h2>
        <div v-if="!feed" class="h-empty">…</div>
        <template v-else>
          <div class="h-obs head" style="grid-template-columns: 1.4fr 1fr 70px 80px"><span>Specimen</span><span>Observer</span><span class="num">Value</span><span class="num">When</span></div>
          <div v-for="(r, i) in feed.items.slice(0, 50)" :key="i" class="h-obs" style="grid-template-columns: 1.4fr 1fr 70px 80px" :class="{ revoked: r.revoked }">
            <RouterLink :to="to.agent(r.tokenId)">{{ r.agentName ?? `Agent ${r.tokenId}` }}</RouterLink>
            <RouterLink :to="to.reviewer(r.client)" class="h-mono">{{ shortAddress(r.client) }}</RouterLink>
            <span class="num">{{ formatScore(r.value) }}</span>
            <span class="num soft">{{ r.createdAt ? formatTimeline(r.createdAt) : '—' }}</span>
          </div>
          <nav class="h-pager"><span /><button v-if="feed.cursor" :disabled="loading" @click="load(true)">{{ loading ? 'Looking…' : 'Earlier sightings' }}</button><span /></nav>
        </template>
      </div>
      <aside class="h-side">
        <h2 class="h-h2" style="margin-top: 0">Most visited specimens</h2>
        <ul class="h-list">
          <li v-for="a in stats.topAgents.slice(0, 10)" :key="a.tokenId.toString()">
            <span><RouterLink :to="to.agent(a.tokenId)"><i>{{ a.agentName ?? `Agent ${a.tokenId}` }}</i></RouterLink></span>
            <span class="soft">{{ a.rows }} visits · {{ a.reviewers }} observers</span>
          </li>
        </ul>
        <h2 class="h-h2">Method</h2>
        <p class="h-prose" style="font-size: 13px">
          The survey reads a window of the network feed, not the whole population. Values are shown as recorded;
          revoked records are struck. Observer labels state their own rule on the observer's sheet.
        </p>
      </aside>
    </div>
  </template>
</template>
