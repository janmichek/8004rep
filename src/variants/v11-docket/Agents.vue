<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { formatDate, formatScore, shortAddress } from '../../format'
import { routes, useAgentList, useChain, useEcosystem, useFiles, usePageQuery } from '../shared/use'

const props = defineProps<{ slug: string }>()
const chain = useChain(() => props.slug)
const to = routes(() => chain.value)
const { page, search, pageLink, setSearch } = usePageQuery()
const { data, error, loading, reload, scores, searchIgnored } = useAgentList(chain, page, search)
const files = useFiles(() => data.value?.items)
const ecosystem = useEcosystem()
const input = ref('')
watch(search, (v) => (input.value = v), { immediate: true })

// A cause's standing is the on-chain mean banded, with the number of
// testimonies that stand behind it. It is not the weighted verdict.
function band(value: number | undefined): { label: string; word: string } {
  if (value === undefined) return { label: '—', word: 'unrated' }
  if (value >= 85) return { label: 'A', word: 'strong' }
  if (value >= 70) return { label: 'B', word: 'mixed' }
  if (value >= 55) return { label: 'C', word: 'mixed' }
  if (value >= 40) return { label: 'D', word: 'doubtful' }
  return { label: 'F', word: 'doubtful' }
}
const rows = computed(() =>
  (data.value?.items ?? []).map((a) => {
    const s = scores.value?.get(a.tokenId)
    const b = band(s?.average)
    return { a, file: files.value.get(a.tokenId), s, band: b, status: s?.count ? b.word : 'unrated' }
  }),
)
const prior = computed(() => ecosystem.data.value?.averageFeedback ?? 50)
</script>

<template>
  <header>
    <p class="d-kicker">Cause list · {{ chain.name }}</p>
    <h1 class="d-h1">Agents entered on the record</h1>
    <p class="d-lede">
      {{ data?.total ?? '—' }} causes are listed in this jurisdiction. Standing is the mean of the testimonies on
      record; the verdict on each agent is only entered after the file is examined.
    </p>
  </header>

  <form class="d-search" @submit.prevent="setSearch(input)">
    <span class="d-label">Find</span>
    <input v-model="input" type="search" placeholder="a party or cause number" aria-label="Search agents" />
    <span class="d-count">{{ prior !== null ? `ecosystem mean ${formatScore(prior)}` : '' }}</span>
  </form>

  <p v-if="searchIgnored" class="d-motif">Only cause numbers can be searched in this jurisdiction.</p>
  <p v-if="error" class="d-error">{{ error }} <button @click="reload">Retry</button></p>
  <p v-else-if="loading || !data" class="d-empty">Retrieving the record…</p>
  <p v-else-if="!data.items.length" class="d-empty">{{ search ? `No cause matches “${search}”.` : 'The list is empty.' }}</p>
  <template v-else>
    <table class="d-table">
      <thead>
        <tr>
          <th>Cause</th>
          <th>Party</th>
          <th>Counsel</th>
          <th class="num">Testimony</th>
          <th class="num">Standing</th>
          <th>Status</th>
          <th class="num">Filed</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in rows" :key="r.a.tokenId.toString()">
          <td class="d-case-no">No. {{ r.a.tokenId }}</td>
          <td>
            <RouterLink :to="to.agent(r.a.tokenId)" class="who">{{ r.file?.name ?? `Agent ${r.a.tokenId}` }}</RouterLink>
            <div v-if="r.file?.description" class="d-motif">{{ r.file.description.slice(0, 96) }}{{ (r.file.description.length ?? 0) > 96 ? '…' : '' }}</div>
          </td>
          <td class="d-mono">
            <RouterLink v-if="r.a.owner" :to="to.owner(r.a.owner)">{{ shortAddress(r.a.owner) }}</RouterLink>
            <span v-else class="soft">—</span>
          </td>
          <td class="num">{{ r.s ? `${r.s.capped ? '≥' : ''}${r.s.count}` : '…' }}</td>
          <td class="num"><b>{{ r.s?.count ? formatScore(r.s.average) : '—' }}</b> <span class="soft">({{ r.band.label }})</span></td>
          <td><span class="d-status" :class="r.status">{{ r.status }}</span></td>
          <td class="num soft">{{ r.a.createdAt ? formatDate(r.a.createdAt) : '—' }}</td>
        </tr>
      </tbody>
    </table>
    <nav v-if="page > 0 || data.hasMore" class="d-pager">
      <RouterLink v-if="page > 0" :to="{ name: 'agents', params: { slug }, ...pageLink(page - 1) }">← Earlier causes</RouterLink><span v-else />
      <span class="soft">page {{ page + 1 }}</span>
      <RouterLink v-if="data.hasMore" :to="{ name: 'agents', params: { slug }, ...pageLink(page + 1) }">Later causes →</RouterLink><span v-else />
    </nav>
  </template>
</template>
