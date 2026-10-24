<script setup lang="ts">
import { computed } from 'vue'
import { addressExplorerUrl } from '../../chains'
import type { AgentSummary } from '../../data/types'
import { formatNumber } from '../../format'
import { routes, useAddress, useAgentList, useChain, useFiles, usePageQuery } from '../shared/use'
import Sheet from './Sheet.vue'
import type { Column } from './sheet'

const props = defineProps<{ slug: string; address: string }>()
const chain = useChain(() => props.slug)
const address = useAddress(() => props.address)
const to = routes(() => chain.value)
const { page, search, pageLink } = usePageQuery()
const { data, error, loading, scores } = useAgentList(chain, page, search, address)
const files = useFiles(() => data.value?.items ?? undefined)
const columns = computed<Column<AgentSummary>[]>(() => [
  { key: 'id', label: 'Token ID', get: (a) => Number(a.tokenId), num: true, formula: 'tokenId' },
  { key: 'name', label: 'Name', get: (a) => files.value.get(a.tokenId)?.name ?? `Agent #${a.tokenId}`, link: (a) => to.agent(a.tokenId), formula: 'registrationFile.name' },
  { key: 'n', label: 'Reviews', get: (a) => scores.value?.get(a.tokenId)?.count, num: true, formula: 'getSummary().count' },
  { key: 'avg', label: 'Average', get: (a) => (scores.value?.get(a.tokenId)?.count ? scores.value.get(a.tokenId)!.average : null), num: true, formula: 'getSummary().value' },
  { key: 'w', label: 'Reviews × avg', get: (a) => (scores.value?.get(a.tokenId)?.count ? scores.value.get(a.tokenId)!.count * scores.value.get(a.tokenId)!.average : null), num: true, formula: 'count × average (sum this column ÷ sum Reviews = review-weighted avg)' },
])
const weighted = computed(() => {
  const xs = (data.value?.items ?? []).map((a) => scores.value?.get(a.tokenId)).filter((s) => s?.count)
  const n = xs.reduce((t, s) => t + s!.count, 0)
  return n ? xs.reduce((t, s) => t + s!.count * s!.average, 0) / n : null
})
</script>

<template>
  <p v-if="!address" class="x-note">#VALUE! — “{{ props.address }}” is not an address.</p>
  <template v-else>
    <div class="x-title">
      <h1 class="mono" style="font-size: 15px">{{ address }}</h1>
      <a :href="addressExplorerUrl(chain, address)" target="_blank" rel="noopener noreferrer">explorer ↗</a>
    </div>
    <div class="x-cards">
      <div><label>Owned</label><b>{{ data?.total ?? '…' }}</b><code>=balanceOf(owner)</code></div>
      <div><label>Review-weighted avg</label><b>{{ formatNumber(weighted) }}</b><code>=SUM(E)/SUM(C)</code></div>
    </div>
    <p v-if="error" class="x-note">#ERROR! {{ error }}</p>
    <p v-else-if="loading || !data" class="soft">Calculating…</p>
    <template v-else>
      <Sheet :rows="data.items" :columns="columns" :name="`owner-${address.slice(0, 8)}`" />
      <div v-if="page > 0 || data.hasMore" class="x-pager">
        <RouterLink v-if="page > 0" :to="pageLink(page - 1)"><button>← Newer</button></RouterLink>
        <RouterLink v-if="data.hasMore" :to="pageLink(page + 1)"><button>Older →</button></RouterLink>
      </div>
    </template>
  </template>
</template>
