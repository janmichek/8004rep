<script setup lang="ts">
import { computed } from 'vue'
import { addressExplorerUrl } from '../../chains'
import { formatDate, formatNumber } from '../../format'
import { routes, useAddress, useAgentList, useChain, useFiles, usePageQuery } from '../shared/use'
import { coordsOf, markRadius, pointOf, terrainOf } from './atlas'

const props = defineProps<{ slug: string; address: string }>()
const chain = useChain(() => props.slug)
const address = useAddress(() => props.address)
const to = routes(() => chain.value)
const { page, pageLink } = usePageQuery()
const { data, error, loading, reload, scores } = useAgentList(chain, page, computed(() => ''), address)
const files = useFiles(() => data.value?.items)
const holdings = computed(() =>
  (data.value?.items ?? []).map((a) => {
    const score = scores.value?.get(a.tokenId)?.average ?? null
    return { a, score, terrain: terrainOf(score), point: pointOf(a.tokenId, 860, 340, 40), coords: coordsOf(a.tokenId), radius: markRadius(scores.value?.get(a.tokenId)?.count) }
  }),
)
</script>

<template>
  <p v-if="!address" class="a-err">“{{ props.address }}” is not an address.</p>
  <template v-else>
    <p class="a-kicker">Holdings</p>
    <h1 class="a-h1">Places held under one hand</h1>
    <p class="a-lede">
      {{ data?.total ?? '…' }} places in {{ chain.name }} are held by
      <a :href="addressExplorerUrl(chain, address)" target="_blank" rel="noopener noreferrer" class="a-mono">{{ address }}</a>.
    </p>
    <p v-if="error" class="a-err">{{ error }} <button @click="reload">Retry</button></p>
    <p v-else-if="loading || !data" class="a-empty">Reading the register…</p>
    <p v-else-if="!data.items.length" class="a-empty">This hand holds no place here.</p>
    <template v-else>
      <div class="a-map-wrap">
        <svg class="a-map" viewBox="0 0 860 340" role="img" aria-label="Map of the places held">
          <line v-for="x in 15" :key="`v${x}`" :x1="(x - 1) * 61.4" y1="0" :x2="(x - 1) * 61.4" y2="340" :class="x % 4 === 1 ? 'a-grat-major' : 'a-grat'" />
          <line v-for="y in 6" :key="`h${y}`" x1="0" :y1="(y - 1) * 68" x2="860" :y2="(y - 1) * 68" :class="y % 3 === 1 ? 'a-grat-major' : 'a-grat'" />
          <path class="a-land" d="M60 100 C 150 40, 300 55, 360 115 C 420 175, 340 255, 220 260 C 100 265, 30 180, 60 100 Z" />
          <path class="a-land" d="M470 90 C 570 40, 740 70, 790 150 C 835 225, 720 300, 610 285 C 500 270, 430 160, 470 90 Z" />
          <path class="a-river" d="M360 115 C 400 170, 460 195, 520 230 C 560 255, 590 260, 620 250" />
          <g v-for="(h, i) in holdings" :key="h.a.tokenId.toString()">
            <circle class="a-mark" :class="h.terrain.tone" :cx="h.point.x" :cy="h.point.y" :r="h.radius">
              <title>{{ i + 1 }} · #{{ h.a.tokenId }} · {{ h.terrain.name }}</title>
            </circle>
            <text class="a-mark-num" :x="h.point.x" :y="h.point.y + 2.5" text-anchor="middle">{{ i + 1 }}</text>
          </g>
        </svg>
      </div>
      <table class="a-table" style="margin-top: 20px">
        <thead><tr><th class="idx">No.</th><th>Place</th><th>Terrain</th><th>Coordinates</th><th class="num">Elevation</th><th class="num">Charted</th></tr></thead>
        <tbody>
          <tr v-for="(h, i) in holdings" :key="h.a.tokenId.toString()">
            <td class="idx">{{ i + 1 }}</td>
            <td><RouterLink :to="to.agent(h.a.tokenId)">{{ files.get(h.a.tokenId)?.name ?? `Place ${h.a.tokenId}` }}</RouterLink> <span class="soft">#{{ h.a.tokenId }}</span></td>
            <td>{{ h.terrain.name }}</td>
            <td class="a-coords">{{ h.coords.text }}</td>
            <td class="num">{{ h.score === null ? '—' : formatNumber(h.score) }}</td>
            <td class="num soft">{{ h.a.createdAt ? formatDate(h.a.createdAt) : '—' }}</td>
          </tr>
        </tbody>
      </table>
      <nav v-if="page > 0 || data.hasMore" class="a-pager">
        <RouterLink v-if="page > 0" :to="{ name: 'owner', params: { slug, address }, ...pageLink(page - 1) }">← Earlier sheets</RouterLink><span v-else />
        <RouterLink v-if="data.hasMore" :to="{ name: 'owner', params: { slug, address }, ...pageLink(page + 1) }">Later sheets →</RouterLink><span v-else />
      </nav>
    </template>
  </template>
</template>
