<script setup lang="ts">
import { computed } from 'vue'
import { addressExplorerUrl } from '../../chains'
import { LABEL_INFO } from '../../data/reviewerProfile'
import { formatDate, formatNumber, formatPercent, formatScore, formatSigned, formatTimeline } from '../../format'
import { routes, useAddress, useChain, useEcosystem, useReviewer } from '../shared/use'
import { coordsOf, pointOf, terrainOf } from './atlas'

const props = defineProps<{ slug: string; address: string }>()
const chain = useChain(() => props.slug)
const address = useAddress(() => props.address)
const to = routes(() => chain.value)
const { feed, error, loading, load, profile, wallet } = useReviewer(chain, address)
const ecosystem = useEcosystem()
const gap = computed(() => {
  const mine = profile.value?.average
  const all = ecosystem.data.value?.averageFeedback
  return mine === null || mine === undefined || all === undefined ? null : mine - all
})
const routePoints = computed(() =>
  (profile.value?.perAgent ?? []).slice(0, 14).map((a, i) => ({
    a,
    i,
    point: pointOf(a.tokenId, 860, 360, 44),
    coords: coordsOf(a.tokenId),
    terrain: terrainOf(a.average),
  })),
)
const line = computed(() => routePoints.value.map((p) => `${p.point.x},${p.point.y}`).join(' '))
</script>

<template>
  <p v-if="!address" class="a-err">“{{ props.address }}” is not an address.</p>
  <template v-else>
    <p class="a-kicker"><RouterLink :to="to.network()">Survey</RouterLink> / surveyor</p>
    <h1 class="a-h1">The surveyor's route</h1>
    <p class="a-lede"><a :href="addressExplorerUrl(chain, address)" target="_blank" rel="noopener noreferrer" class="a-mono">{{ address }}</a> · {{ profile?.agents ?? '…' }} places visited</p>
    <p v-if="error" class="a-err">{{ error }} <button @click="load()">Retry</button></p>
    <p v-else-if="!profile" class="a-empty">Opening the field book…</p>
    <template v-else>
      <div class="a-tiles">
        <div><small>Sightings</small><b>{{ profile.rows }}</b></div>
        <div><small>Places</small><b>{{ profile.agents }}</b></div>
        <div><small>Mean elevation</small><b>{{ formatNumber(profile.average) }}</b></div>
        <div><small>Against the atlas</small><b>{{ formatSigned(gap) }}</b></div>
      </div>

      <div class="a-map-wrap">
        <svg class="a-map" viewBox="0 0 860 360" role="img" aria-label="Route of the surveyor across the places they reviewed">
          <line v-for="x in 15" :key="`v${x}`" :x1="(x - 1) * 61.4" y1="0" :x2="(x - 1) * 61.4" y2="360" :class="x % 4 === 1 ? 'a-grat-major' : 'a-grat'" />
          <line v-for="y in 6" :key="`h${y}`" x1="0" :y1="(y - 1) * 72" x2="860" :y2="(y - 1) * 72" :class="y % 3 === 1 ? 'a-grat-major' : 'a-grat'" />
          <path class="a-land" d="M40 110 C 140 50, 290 70, 340 130 C 390 190, 310 270, 190 275 C 90 280, 10 190, 40 110 Z" />
          <path class="a-land" d="M500 80 C 600 40, 760 70, 815 145 C 865 220, 750 300, 640 290 C 540 280, 465 155, 500 80 Z" />
          <polyline :points="line" fill="none" stroke="var(--a-red)" stroke-width="1.2" stroke-dasharray="4 4" opacity=".75" />
          <g v-for="p in routePoints" :key="p.a.tokenId.toString()">
            <circle class="a-mark" :class="p.terrain.tone" :cx="p.point.x" :cy="p.point.y" r="4.5" />
            <text class="a-mark-num" :x="p.point.x" :y="p.point.y + 2.4" text-anchor="middle">{{ p.i + 1 }}</text>
          </g>
          <text x="20" y="340" font-size="9" fill="var(--a-soft)">Route follows frequency, not chronology.</text>
        </svg>
      </div>

      <div class="a-columns" style="margin-top: 22px">
        <div>
          <h2 class="a-h2" style="margin-top: 0">Places on the route</h2>
          <table class="a-table">
            <thead><tr><th class="idx">No.</th><th>Place</th><th>Terrain</th><th>Coordinates</th><th class="num">Sightings</th><th class="num">Mean</th></tr></thead>
            <tbody>
              <tr v-for="p in routePoints" :key="p.a.tokenId.toString()">
                <td class="idx">{{ p.i + 1 }}</td>
                <td><RouterLink :to="to.agent(p.a.tokenId)">{{ p.a.agentName ?? `Place ${p.a.tokenId}` }}</RouterLink></td>
                <td>{{ p.terrain.name }}</td>
                <td class="a-coords">{{ p.coords.text }}</td>
                <td class="num">{{ p.a.rows }}</td>
                <td class="num">{{ formatNumber(p.a.average) }}</td>
              </tr>
            </tbody>
          </table>

          <h2 class="a-h2">Field notes</h2>
          <div v-if="!feed" class="a-empty">…</div>
          <template v-else>
            <div class="a-field head" style="grid-template-columns: 1.5fr 70px 90px"><span>Place</span><span class="num">Elev.</span><span class="num">When</span></div>
            <div v-for="(r, i) in feed.items.slice(0, 50)" :key="i" class="a-field" style="grid-template-columns: 1.5fr 70px 90px" :class="{ revoked: r.revoked }">
              <RouterLink :to="to.agent(r.tokenId)">{{ r.agentName ?? `Agent ${r.tokenId}` }}</RouterLink>
              <span class="num">{{ formatScore(r.value) }}</span>
              <span class="num soft">{{ r.createdAt ? formatTimeline(r.createdAt) : '—' }}</span>
            </div>
            <nav class="a-pager"><span /><button v-if="feed.cursor" :disabled="loading" @click="load(true)">{{ loading ? 'Turning pages…' : 'Earlier notes' }}</button><span /></nav>
          </template>
        </div>

        <aside class="a-side">
          <h2 class="a-h2" style="margin-top: 0">Surveyor's habits</h2>
          <p v-if="!profile.labels.length" class="a-empty">No habit is charted.</p>
          <div v-for="l in profile.labels" :key="l" class="a-hazard">
            <b>{{ LABEL_INFO[l].label }}.</b> {{ LABEL_INFO[l].rule }}
          </div>
          <p v-if="profile.mode" class="a-note">
            Most common reading {{ formatScore(profile.mode.value) }}, {{ formatPercent(profile.mode.share) }} of live soundings.
            Peak day: {{ profile.peakPerDay }}.
          </p>
          <p v-if="profile.first" class="a-note">First sighting {{ formatDate(profile.first) }}<template v-if="profile.last">; last {{ formatDate(profile.last) }}</template>.</p>
          <h2 class="a-h2">The surveyor</h2>
          <p v-if="wallet.data.value" class="a-note">
            A {{ wallet.data.value.kind ?? 'unknown' }} account with {{ wallet.data.value.nonce ?? '?' }} transactions sent.
          </p>
          <p v-else class="a-empty">Account details unavailable.</p>
          <p class="a-note">A habit is a rule that fired. It is a caution on the map, not a verdict on the surveyor.</p>
        </aside>
      </div>
    </template>
  </template>
</template>
