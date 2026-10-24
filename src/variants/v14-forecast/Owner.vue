<script setup lang="ts">
import { computed } from 'vue'
import { addressExplorerUrl } from '../../chains'
import { formatDate, formatNumber, formatScore } from '../../format'
import { routes, useAddress, useAgentList, useChain, useFiles, usePageQuery } from '../shared/use'
import { conditionOf } from './weather'

const props = defineProps<{ slug: string; address: string }>()
const chain = useChain(() => props.slug)
const address = useAddress(() => props.address)
const to = routes(() => chain.value)
const { page, search, pageLink } = usePageQuery()
const { data, error, loading, reload, scores } = useAgentList(chain, page, search, address)
const files = useFiles(() => data.value?.items ?? undefined)
const mean = computed(() => {
  const live = (data.value?.items ?? []).filter((a) => scores.value?.get(a.tokenId)?.count)
  return live.length ? live.reduce((n, a) => n + (scores.value?.get(a.tokenId)?.average ?? 0), 0) / live.length : null
})
</script>

<template>
  <p v-if="!address" class="f-err">“{{ props.address }}” is not an address.</p>
  <template v-else>
    <p class="f-kicker">Operator</p>
    <h1 class="f-h1">{{ formatNumber(mean) }}<sup style="font-size: .4em">°</sup> across {{ data?.total ?? '…' }} stations</h1>
    <p class="f-prose"><a :href="addressExplorerUrl(chain, address)" target="_blank" rel="noopener noreferrer" class="f-mono">{{ address }}</a> operates these stations in {{ chain.name }}.</p>
    <p v-if="error" class="f-err">{{ error }} <button @click="reload">Retry</button></p>
    <p v-else-if="loading || !data" class="f-empty">Reading the operator's instruments…</p>
    <p v-else-if="!data.items.length" class="f-empty">This address operates no station here.</p>
    <template v-else>
      <table class="f-table">
        <thead><tr><th>Station</th><th>Conditions</th><th class="num">Temperature</th><th class="num">Readings</th><th class="num">Opened</th></tr></thead>
        <tbody>
          <tr v-for="a in data.items" :key="a.tokenId.toString()">
            <td><RouterLink :to="to.agent(a.tokenId)">{{ files.get(a.tokenId)?.name ?? `Station ${a.tokenId}` }} <span class="soft">#{{ a.tokenId }}</span></RouterLink></td>
            <td>{{ conditionOf(scores?.get(a.tokenId)?.average).glyph }} {{ conditionOf(scores?.get(a.tokenId)?.average).label }}</td>
            <td class="num"><b>{{ scores?.get(a.tokenId)?.count ? `${formatScore(scores.get(a.tokenId)!.average)}°` : '—' }}</b></td>
            <td class="num">{{ scores?.get(a.tokenId)?.count ?? '…' }}</td>
            <td class="num soft">{{ a.createdAt ? formatDate(a.createdAt) : '—' }}</td>
          </tr>
        </tbody>
      </table>
      <nav v-if="page > 0 || data.hasMore" class="f-pager">
        <RouterLink v-if="page > 0" :to="{ name: 'owner', params: { slug, address }, ...pageLink(page - 1) }">← Previous</RouterLink><span v-else />
        <RouterLink v-if="data.hasMore" :to="{ name: 'owner', params: { slug, address }, ...pageLink(page + 1) }">Next →</RouterLink><span v-else />
      </nav>
    </template>
  </template>
</template>
