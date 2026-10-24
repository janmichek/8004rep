<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { formatNumber, shortAddress } from '../../format'
import Sigil from '../shared/Sigil.vue'
import { routes, useAgentList, useChain, useFiles, usePageQuery } from '../shared/use'
import Ring from './Ring.vue'

const props = defineProps<{ slug: string }>()
const chain = useChain(() => props.slug)
const to = routes(() => chain.value)
const { page, search, pageLink, setSearch } = usePageQuery()
const { data, error, loading, reload, scores, searchIgnored } = useAgentList(chain, page, search)
const files = useFiles(() => data.value?.items)
const input = ref('')
watch(search, (v) => (input.value = v), { immediate: true })
const PALETTE = ['#6d5dfc', '#18b39a', '#ff8a3d', '#ef4b6c', '#16181d']

const summary = computed(() => {
  const list = data.value?.items ?? []
  const s = scores.value
  if (!s) return undefined
  const rated = list.filter((a) => s.get(a.tokenId)?.count)
  const withFile = list.filter((a) => files.value.get(a.tokenId)).length
  return {
    rated: rated.length,
    reviews: rated.reduce((n, a) => n + s.get(a.tokenId)!.count, 0),
    avg: rated.length ? rated.reduce((n, a) => n + s.get(a.tokenId)!.average, 0) / rated.length : null,
    filed: withFile,
    active: list.filter((a) => files.value.get(a.tokenId)?.active).length,
  }
})
</script>

<template>
  <div class="b-grid" style="margin-bottom: 14px">
    <section class="b-card s6 b-hero">
      <h3>{{ chain.name }}</h3>
      <p class="b-big">{{ data?.total ?? '…' }}</p>
      <p class="soft" style="margin: 4px 0 14px">agents registered</p>
      <form style="display: flex; gap: 8px" @submit.prevent="setSearch(input)">
        <input v-model="input" type="search" placeholder="Search name or token ID" aria-label="Search agents" style="flex: 1; border: 0" />
        <button type="submit" style="border: 0">Search</button>
      </form>
    </section>
    <section class="b-card s2"><h3>Rated</h3><p class="b-mid">{{ summary ? `${summary.rated}/${data?.items.length}` : '…' }}</p><p class="soft">on this page</p></section>
    <section class="b-card s2"><h3>Reviews</h3><p class="b-mid">{{ summary?.reviews ?? '…' }}</p><p class="soft">on this page</p></section>
    <section class="b-card s2 b-dark"><h3>Mean score</h3><p class="b-mid">{{ formatNumber(summary?.avg) }}</p><p class="soft">{{ summary?.active ?? 0 }} active · {{ summary?.filed ?? 0 }} with a file</p></section>
  </div>
  <p v-if="searchIgnored" class="b-notice">{{ chain.name }} is read over RPC — only token IDs can be searched. Showing all agents.</p>
  <p v-if="error" class="b-notice">Could not load agents: {{ error }} <button @click="reload">Retry</button></p>
  <p v-else-if="loading || !data" class="soft">Loading agents…</p>
  <p v-else-if="!data.items.length" class="b-card">{{ search ? `No agent matches “${search}”.` : 'No agents yet.' }}</p>
  <template v-else>
    <div class="b-tiles">
      <RouterLink v-for="a in data.items" :key="a.tokenId.toString()" :to="to.agent(a.tokenId)" class="b-tile">
        <div class="b-row">
          <Sigil :seed="`${a.chainId}:${a.tokenId}`" :image="files.get(a.tokenId)?.image" :size="44" :palette="PALETTE" />
          <div style="min-width: 0; flex: 1">
            <div class="name">{{ files.get(a.tokenId)?.name ?? `Agent #${a.tokenId}` }}</div>
            <div class="soft b-mono">#{{ a.tokenId }}<template v-if="a.owner"> · {{ shortAddress(a.owner) }}</template></div>
          </div>
          <Ring :value="scores?.get(a.tokenId)?.count ? scores.get(a.tokenId)!.average : null" :size="48" />
        </div>
        <div class="desc">{{ files.get(a.tokenId)?.description ?? (files.get(a.tokenId) === null ? 'No registration file' : '') }}</div>
        <div>
          <span v-if="files.get(a.tokenId)?.active" class="b-pill good">active</span>
          <span v-if="files.get(a.tokenId)?.x402Support" class="b-pill">x402</span>
          <span class="b-pill" style="background: #f0f1f5; color: var(--soft)">{{ scores?.get(a.tokenId)?.count ?? '…' }} reviews</span>
        </div>
      </RouterLink>
    </div>
    <nav v-if="page > 0 || data.hasMore" class="b-pager">
      <RouterLink v-if="page > 0" :to="pageLink(page - 1)"><button>← Newer</button></RouterLink>
      <span class="soft">Page {{ page + 1 }}</span>
      <RouterLink v-if="data.hasMore" :to="pageLink(page + 1)"><button>Older →</button></RouterLink>
    </nav>
  </template>
</template>
