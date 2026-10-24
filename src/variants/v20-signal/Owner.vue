<script setup lang="ts">
import { computed } from 'vue'
import { addressExplorerUrl } from '../../chains'
import { formatDate, formatNumber, formatScore, shortAddress } from '../../format'
import { routes, useAddress, useAgentList, useChain, useFiles, usePageQuery } from '../shared/use'
import { bandwidthOf, frequencyOf, freqText, modeOf, sMeterOf } from './radio'

const props = defineProps<{ slug: string; address: string }>()
const chain = useChain(() => props.slug)
const address = useAddress(() => props.address)
const to = routes(() => chain.value)
const { page, pageLink } = usePageQuery()
const { data, error, loading, reload, scores } = useAgentList(chain, page, computed(() => ''), address)
const files = useFiles(() => data.value?.items)
const stations = computed(() =>
  (data.value?.items ?? []).map((a) => {
    const s = scores.value?.get(a.tokenId)
    const freq = frequencyOf(a.tokenId)
    return { a, s, freqText: freqText(freq), name: files.value.get(a.tokenId)?.name, meter: sMeterOf(s?.average), mode: modeOf(s?.average), bandwidth: bandwidthOf(s?.count) }
  }),
)
</script>

<template>
  <p v-if="!address" class="s-err">“{{ props.address }}” is not an address.</p>
  <template v-else>
    <p class="s-kicker">OPERATOR</p>
    <h1 class="s-h1">Transmitters under one licence</h1>
    <p class="s-lede">
      {{ data?.total ?? '…' }} carriers in {{ chain.name }} are operated by
      <a :href="addressExplorerUrl(chain, address)" target="_blank" rel="noopener noreferrer" class="s-mono">{{ address }}</a>.
    </p>
    <p v-if="error" class="s-err">{{ error }} <button @click="reload">Retry</button></p>
    <p v-else-if="loading || !data" class="s-empty">READING LICENCE…</p>
    <p v-else-if="!data.items.length" class="s-empty">NO CARRIERS UNDER THIS LICENCE</p>
    <template v-else>
      <div class="s-tiles">
        <div><small>Carriers</small><b>{{ data.items.length }}</b></div>
        <div><small>On air</small><b>{{ stations.filter((s) => s.s?.count).length }}</b></div>
        <div><small>Licence</small><b style="font-size: 13px">{{ shortAddress(address) }}</b></div>
        <div><small>Tx</small><b>{{ stations.reduce((n, s) => n + (s.s?.count ?? 0), 0) }}</b></div>
      </div>

      <div class="s-grid" style="margin-top: 16px">
        <div v-for="s in stations" :key="s.a.tokenId.toString()" class="s-card">
          <div class="row">
            <RouterLink :to="to.agent(s.a.tokenId)" class="freq">{{ s.freqText }}</RouterLink>
            <span class="s-badge2">{{ s.mode }}</span>
          </div>
          <div class="row">
            <div class="big">{{ s.s?.count ? formatScore(s.s.average) : '—' }}<small style="font-size: 10px; color: var(--s-dim)"> /100</small></div>
            <span class="s-meter"><i v-for="n in 10" :key="n" :class="{ on: n <= s.meter.bars, hot: n > 8 }" /></span>
          </div>
          <div style="font-size: 12px"><RouterLink :to="to.agent(s.a.tokenId)">{{ s.name ?? `Agent ${s.a.tokenId}` }}</RouterLink></div>
          <div class="desc">{{ files.get(s.a.tokenId)?.description ?? 'No description on the carrier.' }}</div>
          <div class="meta">
            <span>{{ formatNumber(s.bandwidth, 1) }} kHz</span>
            <span>{{ s.s?.count ?? 0 }} tx · {{ s.a.createdAt ? formatDate(s.a.createdAt) : 'undated' }}</span>
          </div>
        </div>
      </div>

      <nav v-if="page > 0 || data.hasMore" class="s-pager">
        <RouterLink v-if="page > 0" :to="{ name: 'owner', params: { slug, address }, ...pageLink(page - 1) }">← PREVIOUS</RouterLink><span v-else />
        <span class="soft">PAGE {{ page + 1 }}</span>
        <RouterLink v-if="data.hasMore" :to="{ name: 'owner', params: { slug, address }, ...pageLink(page + 1) }">NEXT →</RouterLink><span v-else />
      </nav>
    </template>
  </template>
</template>
