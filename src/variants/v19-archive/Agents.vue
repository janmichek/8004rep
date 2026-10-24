<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { formatDate, formatNumber, formatScore, shortAddress } from '../../format'
import { routes, useAgentList, useChain, useFiles, usePageQuery } from '../shared/use'
import { accessionYear, callNumberOf, seriesOf } from './archive'

const props = defineProps<{ slug: string }>()
const chain = useChain(() => props.slug)
const to = routes(() => chain.value)
const { page, search, pageLink, setSearch } = usePageQuery()
const { data, error, loading, reload, scores, searchIgnored } = useAgentList(chain, page, search)
const files = useFiles(() => data.value?.items)
const input = ref('')
watch(search, (v) => (input.value = v), { immediate: true })
const records = computed(() =>
  (data.value?.items ?? []).map((a) => {
    const f = files.value.get(a.tokenId)
    const s = scores.value?.get(a.tokenId)
    return { a, f, s, call: callNumberOf(a.tokenId), series: seriesOf(s?.average) }
  }),
)
</script>

<template>
  <p class="x-kicker">Accession register · {{ chain.name }}</p>
  <h1 class="x-h1">Records held in this depository</h1>
  <p class="x-lede">
    {{ data?.total ?? '—' }} accessions are listed. Each card gives the call number, the record's holder, the series it
    is filed under and the state of the item list. Series follows the trusted score, not the raw one.
  </p>

  <form class="x-search" @submit.prevent="setSearch(input)">
    <span>Search the register</span>
    <input v-model="input" type="search" placeholder="title, holder, call number" aria-label="Search agents" />
    <button type="submit">Consult</button>
  </form>
  <p v-if="searchIgnored" class="x-empty">This depository is read over RPC; only call numbers can be searched.</p>
  <p v-if="error" class="x-err">{{ error }} <button @click="reload">Retry</button></p>
  <p v-else-if="loading || !data" class="x-empty">Retrieving the drawer…</p>
  <p v-else-if="!data.items.length" class="x-empty">{{ search ? `No record matches “${search}”.` : 'This depository holds no records.' }}</p>
  <template v-else>
    <ul class="x-cards">
      <li v-for="r in records" :key="r.a.tokenId.toString()" class="x-card">
        <span class="x-stamp" :class="r.series.tone">{{ r.series.stamp }}</span>
        <div class="x-call">{{ r.call }} · SERIES {{ r.series.code }}</div>
        <div class="x-title2"><RouterLink :to="to.agent(r.a.tokenId)">{{ r.f?.name ?? `Agent record ${r.a.tokenId}` }}</RouterLink></div>
        <div class="x-line"><span>Holder</span><span><RouterLink v-if="r.a.owner" :to="to.owner(r.a.owner)">{{ shortAddress(r.a.owner) }}</RouterLink><span v-else>unknown</span></span></div>
        <div class="x-line"><span>Dates</span><span>{{ accessionYear(r.a.createdAt) }}</span></div>
        <div class="x-line"><span>Extent</span><span>{{ r.s?.count ?? 0 }} item{{ r.s?.count === 1 ? '' : 's' }} · mean {{ r.s?.count ? formatScore(r.s.average) : '—' }}</span></div>
        <div class="x-line"><span>Series rule</span><span>{{ r.series.rule }}</span></div>
        <div class="x-line"><span>Subjects</span><span>{{ r.f?.services.map((s) => s.name).join('; ') || 'none' }}</span></div>
        <div class="x-line"><span>Filed</span><span>{{ r.a.createdAt ? formatDate(r.a.createdAt) : 'undated' }}</span></div>
        <div class="x-line"><span>Access</span><span>open · {{ formatNumber(r.a.totalFeedback) }} recorded{{ r.a.totalFeedback === undefined ? ' (index only)' : '' }}</span></div>
      </li>
    </ul>

    <nav v-if="page > 0 || data.hasMore" class="x-pager">
      <RouterLink v-if="page > 0" :to="{ name: 'agents', params: { slug }, ...pageLink(page - 1) }">← Drawer {{ page }}</RouterLink><span v-else />
      <span>Drawer {{ page + 1 }}</span>
      <RouterLink v-if="data.hasMore" :to="{ name: 'agents', params: { slug }, ...pageLink(page + 1) }">Drawer {{ page + 2 }} →</RouterLink><span v-else />
    </nav>
  </template>
</template>
