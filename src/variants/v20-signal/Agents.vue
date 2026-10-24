<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { formatNumber, formatScore, shortAddress } from '../../format'
import { routes, useAgentList, useChain, useFiles, usePageQuery } from '../shared/use'
import { BAND, bandwidthOf, dialX, freqText, frequencyOf, modeOf, sMeterOf } from './radio'

const props = defineProps<{ slug: string }>()
const chain = useChain(() => props.slug)
const to = routes(() => chain.value)
const { page, search, pageLink, setSearch } = usePageQuery()
const { data, error, loading, reload, scores, searchIgnored } = useAgentList(chain, page, search)
const files = useFiles(() => data.value?.items)
const input = ref('')
watch(search, (v) => (input.value = v), { immediate: true })
const stations = computed(() =>
  (data.value?.items ?? []).map((a) => {
    const s = scores.value?.get(a.tokenId)
    const freq = frequencyOf(a.tokenId)
    return {
      a,
      s,
      freq,
      freqText: freqText(freq),
      name: files.value.get(a.tokenId)?.name,
      meter: sMeterOf(s?.average),
      mode: modeOf(s?.average),
      x: dialX(freq, 900, 26),
      height: ((s?.average ?? 0) / 100) * 132,
      bandwidth: bandwidthOf(s?.count),
    }
  }),
)
const ticks = computed(() => Array.from({ length: 11 }, (_, i) => ({ f: BAND.low + i * 2, x: dialX(BAND.low + i * 2, 900, 26) })))
</script>

<template>
  <p class="s-kicker">BAND SCAN · {{ chain.name.toUpperCase() }}</p>
  <h1 class="s-h1">Stations on the reputation band</h1>
  <p class="s-lede">
    {{ data?.total ?? '—' }} carriers between {{ BAND.low.toFixed(2) }} and {{ BAND.high.toFixed(2) }} MHz. Height is the
    station's mean signal; width is occupied bandwidth from the number of transmissions. Frequencies are assigned by
    accession number, not by quality.
  </p>

  <form class="s-search" @submit.prevent="setSearch(input)">
    <span>Tune</span>
    <input v-model="input" type="search" placeholder="call sign, name or number" aria-label="Search agents" />
    <button type="submit">SCAN</button>
  </form>
  <p v-if="searchIgnored" class="s-empty">RPC band: only station numbers are searchable.</p>
  <p v-if="error" class="s-err">{{ error }} <button @click="reload">Retry</button></p>
  <p v-else-if="loading || !data" class="s-empty">SWEEPING THE BAND…</p>
  <p v-else-if="!data.items.length" class="s-empty">{{ search ? `NOTHING AT “${search}”` : 'BAND EMPTY' }}</p>
  <template v-else>
    <svg class="s-dial" viewBox="0 0 900 210" role="img" aria-label="Spectrum plot of the stations on this page">
      <line v-for="v in [0, 25, 50, 75, 100]" :key="v" :x1="26" :y1="176 - (v / 100) * 132" :x2="874" :y2="176 - (v / 100) * 132" :class="v === 0 ? 's-grat-major' : 's-grat'" />
      <text v-for="v in [0, 25, 50, 75, 100]" :key="`t${v}`" x="2" :y="179 - (v / 100) * 132" class="s-dial-label">{{ v }}</text>
      <line v-for="t in ticks" :key="t.f" :x1="t.x" :y1="176" :x2="t.x" :y2="182" class="s-grat-major" />
      <text v-for="t in ticks" :key="`l${t.f}`" :x="t.x" y="198" text-anchor="middle" class="s-dial-label">{{ t.f.toFixed(0) }}</text>
      <g v-for="st in stations" :key="st.a.tokenId.toString()">
        <RouterLink :to="to.agent(st.a.tokenId)">
          <rect
            :x="st.x - Math.max(1.5, st.bandwidth / 6)"
            :y="176 - st.height"
            :width="Math.max(3, st.bandwidth / 3)"
            :height="Math.max(1, st.height)"
            class="s-peak"
            :class="{ weak: (st.s?.average ?? 0) < 40 }"
            opacity=".75"
          >
            <title>{{ st.freqText }} · {{ st.name ?? `Agent ${st.a.tokenId}` }} · {{ st.s?.count ? formatScore(st.s.average) : 'no carrier' }} · {{ st.mode }}</title>
          </rect>
        </RouterLink>
      </g>
      <text x="26" y="208" class="s-dial-label">MHz</text>
    </svg>

    <div class="s-tiles" style="margin-top: 14px">
      <div><small>Stations</small><b>{{ data.items.length }}</b></div>
      <div><small>On carrier</small><b>{{ stations.filter((s) => s.s?.count).length }}</b></div>
      <div><small>Strongest</small><b style="font-size: 14px">{{ stations.reduce((top, s) => ((s.s?.average ?? -1) > (top.s?.average ?? -1) ? s : top), stations[0])?.freqText ?? '—' }}</b></div>
      <div><small>Page</small><b>{{ page + 1 }}</b></div>
    </div>

    <h2 class="s-h2">Station log</h2>
    <table class="s-table">
      <thead><tr><th>Frequency</th><th>Station</th><th>Operator</th><th>S-meter</th><th>Mode</th><th class="num">Signal</th><th class="num">Bandwidth</th><th class="num">Tx</th></tr></thead>
      <tbody>
        <tr v-for="st in stations" :key="st.a.tokenId.toString()">
          <td class="freq">{{ st.freqText }}</td>
          <td><RouterLink :to="to.agent(st.a.tokenId)">{{ st.name ?? `Agent ${st.a.tokenId}` }}</RouterLink> <span class="soft">#{{ st.a.tokenId }}</span></td>
          <td><RouterLink v-if="st.a.owner" :to="to.owner(st.a.owner)" class="soft">{{ shortAddress(st.a.owner) }}</RouterLink><span v-else class="soft">—</span></td>
          <td>
            <span class="s-meter" :title="st.meter.label">
              <i v-for="n in 10" :key="n" :class="{ on: n <= st.meter.bars, hot: n > 8 }" />
            </span>
          </td>
          <td>{{ st.mode }}</td>
          <td class="num">{{ st.s?.count ? formatScore(st.s.average) : '—' }}</td>
          <td class="num">{{ formatNumber(st.bandwidth, 1) }} kHz</td>
          <td class="num">{{ st.s?.count ?? 0 }}</td>
        </tr>
      </tbody>
    </table>

    <nav v-if="page > 0 || data.hasMore" class="s-pager">
      <RouterLink v-if="page > 0" :to="{ name: 'agents', params: { slug }, ...pageLink(page - 1) }">← LOWER BAND</RouterLink><span v-else />
      <span class="soft">SWEEP {{ page + 1 }}</span>
      <RouterLink v-if="data.hasMore" :to="{ name: 'agents', params: { slug }, ...pageLink(page + 1) }">HIGHER BAND →</RouterLink><span v-else />
    </nav>
  </template>
</template>
