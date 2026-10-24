<script setup lang="ts">
import { computed } from 'vue'
import { addressExplorerUrl } from '../../chains'
import { formatDate, formatNumber, formatScore, shortAddress } from '../../format'
import { routes, useAddress, useAgentList, useChain, useFiles, usePageQuery } from '../shared/use'
import { callNumberOf, seriesOf } from './archive'

const props = defineProps<{ slug: string; address: string }>()
const chain = useChain(() => props.slug)
const address = useAddress(() => props.address)
const to = routes(() => chain.value)
const { page, pageLink } = usePageQuery()
const { data, error, loading, reload, scores } = useAgentList(chain, page, computed(() => ''), address)
const files = useFiles(() => data.value?.items)
const records = computed(() =>
  (data.value?.items ?? []).map((a) => {
    const f = files.value.get(a.tokenId)
    const s = scores.value?.get(a.tokenId)
    return { a, f, s, call: callNumberOf(a.tokenId), series: seriesOf(s?.average) }
  }),
)
</script>

<template>
  <p v-if="!address" class="x-err">“{{ props.address }}” is not an address.</p>
  <template v-else>
    <p class="x-kicker">Depositor's file</p>
    <h1 class="x-h1">Records deposited by one hand</h1>
    <p class="x-lede">
      {{ data?.total ?? '…' }} records in {{ chain.name }} are held under
      <a :href="addressExplorerUrl(chain, address)" target="_blank" rel="noopener noreferrer" class="x-mono">{{ address }}</a>.
      The holder may change; the accession does not.
    </p>
    <p v-if="error" class="x-err">{{ error }} <button @click="reload">Retry</button></p>
    <p v-else-if="loading || !data" class="x-empty">Opening the depositor's box…</p>
    <p v-else-if="!data.items.length" class="x-empty">This depositor holds no record here.</p>
    <template v-else>
      <div class="x-sheet" style="margin-bottom: 22px">
        <div class="x-line" style="border-bottom: 1px solid var(--x-ink); padding-bottom: 6px">
          <span>Depositor</span><span>{{ shortAddress(address) }}</span>
        </div>
        <div class="x-line"><span>Records</span><span>{{ data.total ?? data.items.length }} ({{ data.items.length }} in this drawer)</span></div>
        <div class="x-line"><span>Address</span><span class="x-mono">{{ address }}</span></div>
        <div class="x-line"><span>Status</span><span>open accession · no restriction</span></div>
      </div>

      <ul class="x-cards">
        <li v-for="r in records" :key="r.a.tokenId.toString()" class="x-card">
          <span class="x-stamp" :class="r.series.tone">{{ r.series.stamp }}</span>
          <div class="x-call">{{ r.call }} · SERIES {{ r.series.code }}</div>
          <div class="x-title2"><RouterLink :to="to.agent(r.a.tokenId)">{{ r.f?.name ?? `Agent record ${r.a.tokenId}` }}</RouterLink></div>
          <div class="x-line"><span>Dates</span><span>{{ r.a.createdAt ? formatDate(r.a.createdAt) : 'undated' }}</span></div>
          <div class="x-line"><span>Extent</span><span>{{ r.s?.count ?? 0 }} item{{ r.s?.count === 1 ? '' : 's' }}</span></div>
          <div class="x-line"><span>Mean</span><span>{{ r.s?.count ? formatScore(r.s.average) : 'not rated' }}</span></div>
          <div class="x-line"><span>Subjects</span><span>{{ r.f?.services.map((s) => s.name).join('; ') || 'none' }}</span></div>
        </li>
      </ul>

      <nav v-if="page > 0 || data.hasMore" class="x-pager">
        <RouterLink v-if="page > 0" :to="{ name: 'owner', params: { slug, address }, ...pageLink(page - 1) }">← Drawer {{ page }}</RouterLink><span v-else />
        <span>{{ formatNumber(data.items.length) }} records in this drawer</span>
        <RouterLink v-if="data.hasMore" :to="{ name: 'owner', params: { slug, address }, ...pageLink(page + 1) }">Drawer {{ page + 2 }} →</RouterLink><span v-else />
      </nav>
    </template>
  </template>
</template>
