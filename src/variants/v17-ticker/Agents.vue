<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { formatDate, formatNumber, formatScore, shortAddress } from '../../format'
import { routes, useAgentList, useChain, useFiles, usePageQuery } from '../shared/use'
import { ratingOf, symbolOf } from './market'

const props = defineProps<{ slug: string }>()
const chain = useChain(() => props.slug)
const to = routes(() => chain.value)
const { page, search, pageLink, setSearch } = usePageQuery()
const { data, error, loading, reload, scores, searchIgnored } = useAgentList(chain, page, search)
const files = useFiles(() => data.value?.items)
const input = ref('')
watch(search, (v) => (input.value = v), { immediate: true })
const listed = computed(() =>
  (data.value?.items ?? []).map((a) => {
    const s = scores?.value?.get(a.tokenId)
    return { a, s, name: files.value.get(a.tokenId)?.name, sym: symbolOf(files.value.get(a.tokenId)?.name, a.tokenId), rating: ratingOf(s?.average) }
  }),
)
const breadth = computed(() => {
  const withPrice = listed.value.filter((r) => r.s?.count)
  const mean = withPrice.length ? withPrice.reduce((n, r) => n + (r.s?.average ?? 0), 0) / withPrice.length : null
  const best = withPrice.reduce<(typeof withPrice)[number] | undefined>((top, r) => (!top || (r.s?.average ?? 0) > (top.s?.average ?? 0) ? r : top), undefined)
  return { mean, best, priced: withPrice.length }
})
</script>

<template>
  <p class="t-kicker">LISTINGS · {{ chain.name.toUpperCase() }}</p>
  <h1 class="t-h1">Reputation listings</h1>
  <p class="t-lede">
    {{ data?.total ?? '—' }} agents quoted on {{ chain.name }}. Last is the on-chain mean; volume is the number of
    ratings behind it. Grades are a fixed banding of that mean, not a recommendation.
  </p>

  <form class="t-search" @submit.prevent="setSearch(input)">
    <span>Find</span>
    <input v-model="input" type="search" placeholder="symbol, name or number" aria-label="Search agents" />
    <button type="submit">Go</button>
  </form>
  <p v-if="searchIgnored" class="t-empty">RPC venue: only token numbers are searchable.</p>
  <p v-if="error" class="t-err">{{ error }} <button @click="reload">Retry</button></p>
  <p v-else-if="loading || !data" class="t-empty">LOADING QUOTES…</p>
  <p v-else-if="!data.items.length" class="t-empty">{{ search ? `NO MATCH FOR “${search}”` : 'NO LISTINGS' }}</p>
  <template v-else>
    <div class="t-tiles">
      <div><small>On this page</small><b>{{ listed.length }}</b></div>
      <div><small>Quoted</small><b>{{ breadth.priced }}</b></div>
      <div><small>Page mean</small><b>{{ breadth.mean === null ? '—' : formatNumber(breadth.mean) }}</b></div>
      <div><small>Top</small><b style="font-size: 16px">{{ breadth.best?.sym ?? '—' }}</b></div>
    </div>

    <h2 class="t-h2">Quote board</h2>
    <table class="t-table">
      <thead>
        <tr><th>Symbol</th><th>Name</th><th>Owner</th><th class="num">Last</th><th class="num">Volume</th><th>Grade</th><th>Listed</th><th class="num">Range</th></tr>
      </thead>
      <tbody>
        <tr v-for="r in listed" :key="r.a.tokenId.toString()">
          <td class="sym"><RouterLink :to="to.agent(r.a.tokenId)" class="t-sym">{{ r.sym }}</RouterLink></td>
          <td><RouterLink :to="to.agent(r.a.tokenId)">{{ r.name ?? `Agent ${r.a.tokenId}` }}</RouterLink> <span class="t-dim">#{{ r.a.tokenId }}</span></td>
          <td><RouterLink v-if="r.a.owner" :to="to.owner(r.a.owner)" class="t-dim">{{ shortAddress(r.a.owner) }}</RouterLink><span v-else class="t-dim">—</span></td>
          <td class="num" :class="r.s?.count ? (r.s.average >= 80 ? 't-up' : r.s.average < 40 ? 't-down' : '') : 't-dim'">{{ r.s?.count ? formatScore(r.s.average) : '—' }}</td>
          <td class="num">{{ r.s?.count ?? 0 }}</td>
          <td><span class="t-badge" :class="{ info: r.rating.startsWith('A'), hot: r.rating === 'D' || r.rating === 'C' }">{{ r.rating }}</span></td>
          <td class="t-dim">{{ r.a.createdAt ? formatDate(r.a.createdAt) : '—' }}</td>
          <td class="num">
            <span style="display: inline-block; width: 62px; height: 5px; background: #16211f; vertical-align: middle">
              <span :style="{ display: 'block', height: '100%', width: `${r.s?.average ?? 0}%`, background: (r.s?.average ?? 0) >= 60 ? 'var(--t-up)' : 'var(--t-down)' }" />
            </span>
          </td>
        </tr>
      </tbody>
    </table>

    <nav v-if="page > 0 || data.hasMore" class="t-pager">
      <RouterLink v-if="page > 0" :to="{ name: 'agents', params: { slug }, ...pageLink(page - 1) }">← PREV PAGE</RouterLink><span v-else />
      <span class="t-dim">PAGE {{ page + 1 }}</span>
      <RouterLink v-if="data.hasMore" :to="{ name: 'agents', params: { slug }, ...pageLink(page + 1) }">NEXT PAGE →</RouterLink><span v-else />
    </nav>
  </template>
</template>
