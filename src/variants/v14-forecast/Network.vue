<script setup lang="ts">
import { computed } from 'vue'
import { formatDate, formatNumber, formatPercent, formatScore, formatTimeline, shortAddress } from '../../format'
import { histogram, labelsText } from '../shared/metrics'
import { routes, useChain, useNetwork } from '../shared/use'
import { conditionOf } from './weather'

const props = defineProps<{ slug: string }>()
const chain = useChain(() => props.slug)
const to = routes(() => chain.value)
const { feed, error, loading, load, stats, ecosystem } = useNetwork(chain)
const condition = computed(() => conditionOf(stats.value?.average))
const bins = computed(() => histogram((feed.value?.items ?? []).filter((r) => !r.revoked).map((r) => r.value), 10))
const peak = computed(() => Math.max(1, ...bins.value.map((b) => b.count)))
</script>

<template>
  <p class="f-kicker">Regional bulletin · {{ chain.name }}</p>
  <h1 class="f-h1">Reputation weather across the region</h1>
  <p class="f-lede">
    {{ stats?.rows ?? '…' }} readings from {{ stats?.reviewers ?? '…' }} observers at {{ stats?.agents ?? '…' }} stations.
    The regional temperature is the mean of all live readings; the distribution shows how unevenly it is made.
  </p>

  <p v-if="error" class="f-err">{{ error }} <button @click="load()">Retry</button></p>
  <p v-else-if="!stats" class="f-empty">Warming up the instruments…</p>
  <template v-else>
    <div class="f-now">
      <div>
        <div class="f-temp">{{ formatNumber(stats.average) }}<sup>°</sup></div>
        <div class="f-condition">{{ condition.label }} · regional mean</div>
      </div>
      <div>
        <p class="f-prose" style="margin: 0 0 6px">{{ formatPercent(stats.perfectShare) }} of live readings are a perfect 100.</p>
        <p class="f-prose" style="margin: 0; font-size: 13px">
          {{ stats.revoked }} readings were struck. {{ stats.suspects.length }} observers carry a habit label and
          {{ stats.lookalikes.length }} groups of stations share their observers.
        </p>
      </div>
      <span class="f-glyph" aria-hidden="true">{{ condition.glyph }}</span>
    </div>

    <div class="f-stats">
      <div class="f-stat"><small>Regional mean</small><b>{{ formatNumber(stats.average) }}°</b></div>
      <div class="f-stat"><small>Perfect readings</small><b>{{ formatPercent(stats.perfectShare) }}</b></div>
      <div class="f-stat"><small>Stations</small><b>{{ stats.agents }}</b></div>
      <div class="f-stat"><small>Ecosystem mean</small><b>{{ formatNumber(ecosystem.data.value?.averageFeedback) }}°</b></div>
    </div>

    <div class="f-columns">
      <div>
        <h2 class="f-h2">Distribution of readings</h2>
        <div class="f-hist">
          <span v-for="(b, i) in bins" :key="i" :style="{ height: `${(b.count / peak) * 100}%` }" :title="`${b.from}–${b.to}: ${b.count}`" />
        </div>
        <div class="f-hist-labels"><span>0°</span><span>25°</span><span>50°</span><span>75°</span><span>100°</span></div>

        <h2 class="f-h2">Storm warnings</h2>
        <p class="f-empty" v-if="!stats.suspects.length">No observer patterns are in effect.</p>
        <table v-else class="f-table">
          <thead><tr><th>Observer</th><th>Pattern</th><th class="num">Readings</th><th class="num">Stations</th><th class="num">Mean</th></tr></thead>
          <tbody>
            <tr v-for="s in stats.suspects.slice(0, 14)" :key="s.client">
              <td><RouterLink :to="to.reviewer(s.client)" class="f-mono">{{ shortAddress(s.client) }}</RouterLink></td>
              <td class="f-warn">{{ labelsText(s.labels) }}</td>
              <td class="num">{{ s.rows }}</td>
              <td class="num">{{ s.agents }}</td>
              <td class="num">{{ formatNumber(s.average) }}°</td>
            </tr>
          </tbody>
        </table>

        <h2 class="f-h2">Weather fronts</h2>
        <p class="f-empty" v-if="!stats.lookalikes.length">No station groups share their observers.</p>
        <ul v-else class="f-list">
          <li v-for="(g, i) in stats.lookalikes.slice(0, 10)" :key="i">
            <span>
              {{ formatPercent(g.similarity) }} shared —
              <template v-for="a in g.agents" :key="a.tokenId.toString()">
                <RouterLink :to="to.agent(a.tokenId)">{{ a.agentName ?? `#${a.tokenId}` }}</RouterLink><template v-if="a !== g.agents.at(-1)">, </template>
              </template>
            </span>
          </li>
        </ul>

        <h2 class="f-h2">Latest reports</h2>
        <div v-if="!feed" class="f-empty">…</div>
        <template v-else>
          <div class="f-obs head" style="grid-template-columns: 1.4fr 1fr 70px 80px"><span>Station</span><span>Observer</span><span class="num">Value</span><span class="num">When</span></div>
          <div v-for="(r, i) in feed.items.slice(0, 50)" :key="i" class="f-obs" style="grid-template-columns: 1.4fr 1fr 70px 80px" :class="{ revoked: r.revoked }">
            <RouterLink :to="to.agent(r.tokenId)">{{ r.agentName ?? `Agent ${r.tokenId}` }}</RouterLink>
            <RouterLink :to="to.reviewer(r.client)" class="f-mono">{{ shortAddress(r.client) }}</RouterLink>
            <span class="num">{{ formatScore(r.value) }}°</span>
            <span class="num soft">{{ r.createdAt ? formatTimeline(r.createdAt) : '—' }}</span>
          </div>
          <nav class="f-pager"><span /><button v-if="feed.cursor" :disabled="loading" @click="load(true)">{{ loading ? 'Reading…' : 'Earlier reports' }}</button><span /></nav>
        </template>
      </div>
      <aside>
        <div class="f-panel">
          <h3>Warmest stations</h3>
          <ul class="f-list">
            <li v-for="a in stats.topAgents.slice(0, 10)" :key="a.tokenId.toString()">
              <span><RouterLink :to="to.agent(a.tokenId)">{{ a.agentName ?? `Agent ${a.tokenId}` }}</RouterLink></span>
              <span class="soft">{{ a.rows }} obs · {{ formatNumber(a.average) }}°</span>
            </li>
          </ul>
        </div>
        <div class="f-panel" style="margin-top: 14px">
          <h3>Bulletin notes</h3>
          <p class="f-prose" style="font-size: 13px">
            <template v-if="stats.from && stats.to">The window runs {{ formatDate(stats.from) }} to {{ formatDate(stats.to) }}. </template>
            Temperatures are raw means; they do not apply the weighting rules used on a station page. Open a station
            for its trusted temperature and advisories.
          </p>
        </div>
      </aside>
    </div>
  </template>
</template>
