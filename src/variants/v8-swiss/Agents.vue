<script setup lang="ts">
import { ref, watch } from 'vue'
import { formatDate, formatScore, shortAddress } from '../../format'
import { routes, useAgentList, useChain, useFiles, usePageQuery } from '../shared/use'

const props = defineProps<{ slug: string }>()
const chain = useChain(() => props.slug)
const to = routes(() => chain.value)
const { page, search, pageLink, setSearch } = usePageQuery()
const { data, error, loading, reload, scores, searchIgnored } = useAgentList(chain, page, search)
const files = useFiles(() => data.value?.items)
const input = ref('')
watch(search, (v) => (input.value = v), { immediate: true })
</script>

<template>
  <div class="w-grid">
    <p class="w-hero" style="grid-column: span 8">{{ data?.total ?? (loading ? '…' : '—') }}</p>
    <div style="grid-column: span 4; align-self: end; padding-bottom: 22px">
      <p class="w-label">Agents on {{ chain.name }}</p>
      <form style="display: flex; gap: 16px; margin-top: 12px" @submit.prevent="setSearch(input)">
        <input v-model="input" type="search" placeholder="Name or ID" aria-label="Search agents" style="flex: 1" />
        <button type="submit">Search</button>
      </form>
    </div>
  </div>
  <p v-if="searchIgnored" class="w-red">Only token IDs can be searched on {{ chain.name }}.</p>
  <p v-if="error" class="w-red">{{ error }} <button @click="reload">Retry</button></p>
  <p v-else-if="!loading && data && !data.items.length" class="w-sentence">{{ search ? `Nothing matches “${search}”.` : 'No agents.' }}</p>
  <template v-else-if="data && !loading">
    <div class="w-row head"><span>Agent</span><span class="r">ID</span><span class="r">Reviews</span><span class="r">Average</span><span class="r">Created</span></div>
    <RouterLink v-for="a in data.items" :key="a.tokenId.toString()" :to="to.agent(a.tokenId)" class="w-row" style="border-bottom: 0">
      <span><b>{{ files.get(a.tokenId)?.name ?? `Agent ${a.tokenId}` }}</b> <span v-if="a.owner" class="soft mono">{{ shortAddress(a.owner) }}</span></span>
      <span class="r">{{ a.tokenId }}</span>
      <span class="r">{{ scores?.get(a.tokenId)?.count ?? '·' }}</span>
      <span class="r"><b>{{ scores?.get(a.tokenId)?.count ? formatScore(scores.get(a.tokenId)!.average) : '—' }}</b></span>
      <span class="r soft">{{ a.createdAt ? formatDate(a.createdAt) : '' }}</span>
    </RouterLink>
    <nav v-if="page > 0 || data.hasMore" class="w-pager">
      <RouterLink v-if="page > 0" :to="pageLink(page - 1)">Newer</RouterLink><span v-else />
      <span class="soft">{{ page + 1 }}</span>
      <RouterLink v-if="data.hasMore" :to="pageLink(page + 1)">Older</RouterLink><span v-else />
    </nav>
  </template>
</template>
