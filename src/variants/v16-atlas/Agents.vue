<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { formatNumber, formatScore, shortAddress } from '../../format'
import { routes, useAgentList, useChain, useFiles, usePageQuery } from '../shared/use'
import { RELIEF, coordsOf, markRadius, pointOf, terrainOf } from './atlas'

const props = defineProps<{ slug: string }>()
const chain = useChain(() => props.slug)
const to = routes(() => chain.value)
const { page, search, pageLink, setSearch } = usePageQuery()
const { data, error, loading, reload, scores, searchIgnored } = useAgentList(chain, page, search)
const files = useFiles(() => data.value?.items)
const input = ref('')
watch(search, (v) => (input.value = v), { immediate: true })
const marks = computed(() =>
  (data.value?.items ?? []).map((a, i) => {
    const score = scores.value?.get(a.tokenId)?.average ?? null
    return {
      a,
      i,
      score,
      terrain: terrainOf(score),
      point: pointOf(a.tokenId, 900, 520, 46),
      coords: coordsOf(a.tokenId),
      radius: markRadius(scores.value?.get(a.tokenId)?.count),
    }
  }),
)
</script>

<template>
  <p class="a-kicker">Gazetteer · {{ chain.name }}</p>
  <h1 class="a-h1">Places on the sheet</h1>
  <p class="a-lede">
    {{ data?.total ?? '—' }} places are charted in this region. Marks are placed for legibility, not geography; their
    size follows the number of soundings, their colour the mean elevation of those soundings.
  </p>

  <form class="a-search" @submit.prevent="setSearch(input)">
    <span>Find a place</span>
    <input v-model="input" type="search" placeholder="name, service or number" aria-label="Search agents" />
    <button type="submit">Locate</button>
  </form>
  <p v-if="searchIgnored" class="a-empty">This region is read over RPC; only place numbers can be searched.</p>
  <p v-if="error" class="a-err">{{ error }} <button @click="reload">Retry</button></p>
  <p v-else-if="loading || !data" class="a-empty">Unrolling the sheet…</p>
  <p v-else-if="!data.items.length" class="a-empty">{{ search ? `No place matches “${search}”.` : 'This region has no places.' }}</p>
  <template v-else>
    <div class="a-map-wrap">
      <svg class="a-map" viewBox="0 0 900 520" role="img" aria-label="Map of the agents on this page">
        <defs>
          <pattern id="a-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(29,59,54,.12)" stroke-width="1" />
          </pattern>
        </defs>
        <g>
          <line v-for="x in 17" :key="`v${x}`" :x1="(x - 1) * 56.25" y1="0" :x2="(x - 1) * 56.25" y2="520" :class="x % 4 === 1 ? 'a-grat-major' : 'a-grat'" />
          <line v-for="y in 9" :key="`h${y}`" x1="0" :y1="(y - 1) * 65" x2="900" :y2="(y - 1) * 65" :class="y % 4 === 1 ? 'a-grat-major' : 'a-grat'" />
        </g>
        <path class="a-land" d="M60 120 C 120 60, 250 75, 300 130 C 350 185, 290 245, 225 250 C 160 255, 90 205, 60 120 Z" />
        <path class="a-land" d="M540 70 C 620 40, 760 70, 805 140 C 850 210, 780 275, 690 270 C 610 265, 530 200, 540 70 Z" />
        <path class="a-land" d="M120 330 C 200 290, 330 320, 380 385 C 425 445, 340 490, 245 485 C 160 480, 95 415, 120 330 Z" />
        <path class="a-land" d="M600 320 C 680 290, 820 310, 860 380 C 895 445, 800 490, 710 480 C 630 470, 565 395, 600 320 Z" />
        <path class="a-river" d="M300 130 C 330 200, 420 230, 470 300 C 500 345, 560 350, 600 320" />
        <g v-for="r in RELIEF" :key="r">
          <ellipse class="a-contour" cx="700" cy="160" :rx="r * 1.35" :ry="r * .72" />
          <ellipse class="a-contour" cx="240" cy="400" :rx="r * 1.1" :ry="r * .6" />
        </g>
        <ellipse class="a-land" cx="700" cy="160" rx="26" ry="14" />
        <text class="a-mark-label" x="56" y="96" font-style="italic" font-size="11">Mare Reputationis</text>
        <text class="a-mark-label" x="640" y="468" font-style="italic" font-size="11">Terra Fiduciae</text>
        <text class="a-mark-label" x="690" y="146" font-size="8">Mons Laurus</text>
        <g v-for="m in marks" :key="m.a.tokenId.toString()">
          <RouterLink :to="to.agent(m.a.tokenId)">
            <circle
              class="a-mark"
              :class="m.terrain.tone"
              :cx="m.point.x"
              :cy="m.point.y"
              :r="m.radius"
              :fill="m.terrain.tone === 'none' ? 'none' : undefined"
            >
              <title>{{ m.i + 1 }} · {{ m.terrain.name }} · {{ m.score === null ? 'no soundings' : `${formatScore(m.score)} mean` }}</title>
            </circle>
            <text class="a-mark-num" :x="m.point.x" :y="m.point.y + 2.6" text-anchor="middle">{{ m.i + 1 }}</text>
          </RouterLink>
        </g>
        <g transform="translate(840 470)">
          <circle r="20" fill="rgba(241,233,212,.85)" stroke="rgba(29,59,54,.4)" />
          <path d="M0 -16 L5 0 L0 16 L-5 0 Z" fill="var(--a-red)" />
          <text y="-22" text-anchor="middle" font-size="7" fill="var(--a-ink)">N</text>
        </g>
      </svg>
    </div>
    <p class="a-legend">
      <span><i class="t-high" /> highland (85+)</span>
      <span><i class="t-mid" /> plateau (65+)</span>
      <span><i class="t-low" /> lowland / marsh</span>
      <span><i class="t-none" /> uncharted</span>
      <span>Mark size = soundings</span>
    </p>

    <table class="a-table" style="margin-top: 22px">
      <thead>
        <tr><th class="idx">No.</th><th>Place</th><th>Terrain</th><th>Holder</th><th>Coordinates</th><th class="num">Soundings</th><th class="num">Elevation</th></tr>
      </thead>
      <tbody>
        <tr v-for="m in marks" :key="m.a.tokenId.toString()">
          <td class="idx">{{ m.i + 1 }}</td>
          <td><RouterLink :to="to.agent(m.a.tokenId)">{{ files.get(m.a.tokenId)?.name ?? `Place ${m.a.tokenId}` }}</RouterLink> <span class="soft">#{{ m.a.tokenId }}</span></td>
          <td>{{ m.terrain.name }}</td>
          <td><RouterLink v-if="m.a.owner" :to="to.owner(m.a.owner)" class="a-mono">{{ shortAddress(m.a.owner) }}</RouterLink><span v-else>—</span></td>
          <td class="a-coords">{{ m.coords.text }}</td>
          <td class="num">{{ scores?.get(m.a.tokenId)?.count ?? '…' }}</td>
          <td class="num">{{ m.score === null ? '—' : formatNumber(m.score) }}</td>
        </tr>
      </tbody>
    </table>

    <nav v-if="page > 0 || data.hasMore" class="a-pager">
      <RouterLink v-if="page > 0" :to="{ name: 'agents', params: { slug }, ...pageLink(page - 1) }">← Earlier sheets</RouterLink><span v-else />
      <span class="soft">sheet {{ page + 1 }}</span>
      <RouterLink v-if="data.hasMore" :to="{ name: 'agents', params: { slug }, ...pageLink(page + 1) }">Later sheets →</RouterLink><span v-else />
    </nav>
  </template>
</template>
