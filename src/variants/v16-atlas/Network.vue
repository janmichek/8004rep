<script setup lang="ts">
import { computed } from 'vue'
import { formatDate, formatNumber, formatPercent, formatScore, formatTimeline, shortAddress } from '../../format'
import { labelsText } from '../shared/metrics'
import { routes, useChain, useNetwork } from '../shared/use'
import { coordsOf, markRadius, pointOf, terrainOf } from './atlas'

const props = defineProps<{ slug: string }>()
const chain = useChain(() => props.slug)
const to = routes(() => chain.value)
const { feed, error, loading, load, stats, ecosystem } = useNetwork(chain)
const places = computed(() =>
  (stats.value?.topAgents ?? []).map((a) => ({
    a,
    point: pointOf(a.tokenId, 900, 440, 50),
    coords: coordsOf(a.tokenId),
    terrain: terrainOf(a.average),
    radius: markRadius(a.rows),
  })),
)
</script>

<template>
  <p class="a-kicker">Territorial survey · {{ chain.name }}</p>
  <h1 class="a-h1">The shape of the territory</h1>
  <p class="a-lede">
    {{ stats?.rows ?? '…' }} sightings by {{ stats?.reviewers ?? '…' }} surveyors across {{ stats?.agents ?? '…' }} places.
    The map plots the most-visited places; the survey below counts what the visits say.
  </p>

  <p v-if="error" class="a-err">{{ error }} <button @click="load()">Retry</button></p>
  <p v-else-if="!stats" class="a-empty">Surveying…</p>
  <template v-else>
    <div class="a-tiles">
      <div><small>Sightings</small><b>{{ stats.rows }}</b></div>
      <div><small>Mean elevation</small><b>{{ formatNumber(stats.average) }}</b></div>
      <div><small>Perfect soundings</small><b>{{ formatPercent(stats.perfectShare) }}</b></div>
      <div><small>Struck from the log</small><b>{{ stats.revoked }}</b></div>
    </div>
    <p class="a-note">
      <template v-if="stats.from && stats.to">Survey window {{ formatDate(stats.from) }} – {{ formatDate(stats.to) }}. </template>
      The wider atlas mean is {{ formatNumber(ecosystem.data.value?.averageFeedback) }}.
    </p>

    <div class="a-map-wrap">
      <svg class="a-map" viewBox="0 0 900 440" role="img" aria-label="Map of the most visited places">
        <line v-for="x in 17" :key="`v${x}`" :x1="(x - 1) * 56.25" y1="0" :x2="(x - 1) * 56.25" y2="440" :class="x % 4 === 1 ? 'a-grat-major' : 'a-grat'" />
        <line v-for="y in 8" :key="`h${y}`" x1="0" :y1="(y - 1) * 62.86" x2="900" :y2="(y - 1) * 62.86" :class="y % 4 === 1 ? 'a-grat-major' : 'a-grat'" />
        <path class="a-land" d="M40 120 C 130 40, 300 60, 380 130 C 450 195, 380 280, 260 290 C 140 300, 20 220, 40 120 Z" />
        <path class="a-land" d="M510 80 C 620 30, 800 60, 855 150 C 905 235, 800 320, 690 310 C 580 300, 480 180, 510 80 Z" />
        <path class="a-land" d="M120 340 C 200 300, 300 330, 340 380 C 380 430, 250 450, 170 435 C 100 422, 70 380, 120 340 Z" />
        <ellipse class="a-land" cx="580" cy="380" rx="90" ry="36" />
        <path class="a-river" d="M380 130 C 420 220, 470 250, 520 300 C 560 340, 540 380, 580 380" />
        <g v-for="p in places" :key="p.a.tokenId.toString()">
          <RouterLink :to="to.agent(p.a.tokenId)">
            <circle class="a-mark" :class="p.terrain.tone" :cx="p.point.x" :cy="p.point.y" :r="p.radius">
              <title>{{ p.a.agentName ?? `Place ${p.a.tokenId}` }} · {{ p.a.rows }} sightings · {{ p.a.average === null ? 'no mean' : formatNumber(p.a.average) }}</title>
            </circle>
            <text class="a-mark-label" :x="p.point.x + p.radius + 4" :y="p.point.y + 3">{{ (p.a.agentName ?? `#${p.a.tokenId}`).slice(0, 22) }}</text>
          </RouterLink>
        </g>
        <g transform="translate(852 392)">
          <circle r="18" fill="rgba(241,233,212,.85)" stroke="rgba(29,59,54,.4)" />
          <path d="M0 -14 L4 0 L0 14 L-4 0 Z" fill="var(--a-red)" />
        </g>
      </svg>
    </div>
    <p class="a-legend">
      <span><i class="t-high" /> highland</span><span><i class="t-mid" /> plateau</span>
      <span><i class="t-low" /> lowland / marsh</span><span>Mark size = sightings</span>
    </p>

    <div class="a-columns" style="margin-top: 24px">
      <div>
        <h2 class="a-h2" style="margin-top: 0">Visited places</h2>
        <table class="a-table">
          <thead><tr><th>Place</th><th>Terrain</th><th>Coordinates</th><th class="num">Sightings</th><th class="num">Surveyors</th><th class="num">Elevation</th></tr></thead>
          <tbody>
            <tr v-for="p in places" :key="p.a.tokenId.toString()">
              <td><RouterLink :to="to.agent(p.a.tokenId)">{{ p.a.agentName ?? `Place ${p.a.tokenId}` }}</RouterLink></td>
              <td>{{ p.terrain.name }}</td>
              <td class="a-coords">{{ p.coords.text }}</td>
              <td class="num">{{ p.a.rows }}</td>
              <td class="num">{{ p.a.reviewers }}</td>
              <td class="num">{{ p.a.average === null ? '—' : formatNumber(p.a.average) }}</td>
            </tr>
          </tbody>
        </table>

        <h2 class="a-h2">Recent sightings</h2>
        <div v-if="!feed" class="a-empty">…</div>
        <template v-else>
          <div class="a-field head" style="grid-template-columns: 1.4fr 1fr 70px 80px"><span>Place</span><span>Surveyor</span><span class="num">Elev.</span><span class="num">When</span></div>
          <div v-for="(r, i) in feed.items.slice(0, 50)" :key="i" class="a-field" style="grid-template-columns: 1.4fr 1fr 70px 80px" :class="{ revoked: r.revoked }">
            <RouterLink :to="to.agent(r.tokenId)">{{ r.agentName ?? `Agent ${r.tokenId}` }}</RouterLink>
            <RouterLink :to="to.reviewer(r.client)" class="a-mono">{{ shortAddress(r.client) }}</RouterLink>
            <span class="num">{{ formatScore(r.value) }}</span>
            <span class="num soft">{{ r.createdAt ? formatTimeline(r.createdAt) : '—' }}</span>
          </div>
          <nav class="a-pager"><span /><button v-if="feed.cursor" :disabled="loading" @click="load(true)">{{ loading ? 'Surveying…' : 'Earlier sightings' }}</button><span /></nav>
        </template>
      </div>

      <aside class="a-side">
        <h2 class="a-h2" style="margin-top: 0">Hazards to navigation</h2>
        <p v-if="!stats.suspects.length" class="a-empty">No surveyor patterns are charted.</p>
        <div v-for="s in stats.suspects.slice(0, 12)" :key="s.client" class="a-hazard">
          <RouterLink :to="to.reviewer(s.client)" class="a-mono">{{ shortAddress(s.client) }}</RouterLink>
          — <b>{{ labelsText(s.labels) }}</b>. {{ s.rows }} sightings over {{ s.agents }} places, mean {{ formatNumber(s.average) }}.
        </div>

        <h2 class="a-h2">Twin islands</h2>
        <p v-if="!stats.lookalikes.length" class="a-empty">No places share their surveyors.</p>
        <div v-for="(g, i) in stats.lookalikes.slice(0, 8)" :key="i" class="a-hazard">
          {{ formatPercent(g.similarity) }} shared surveyors:
          <template v-for="a in g.agents" :key="a.tokenId.toString()">
            <RouterLink :to="to.agent(a.tokenId)">{{ a.agentName ?? `#${a.tokenId}` }}</RouterLink><template v-if="a !== g.agents.at(-1)">, </template>
          </template>
        </div>

        <h2 class="a-h2">Reading the sheet</h2>
        <p class="a-note">
          Positions are a reading aid. Elevation is the raw mean of soundings; the place file applies the survey
          corrections and prints each step.
        </p>
      </aside>
    </div>
  </template>
</template>
